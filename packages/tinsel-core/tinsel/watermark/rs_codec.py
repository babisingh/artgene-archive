"""Reed-Solomon codec over GF(2^8) for TINSEL watermark error correction.

Algorithm
---------
Systematic Reed-Solomon encoding and decoding using:
- Field: GF(2^8) with primitive polynomial 0x11d (x^8+x^4+x^3+x^2+1)
- Generator root: α = 2 (primitive element), first consecutive root at α^0
- Berlekamp-Massey algorithm for error-locator polynomial
- Forney algorithm for error-magnitude computation

Error-locator polynomial convention
------------------------------------
For errors at positions j_0, j_1, … (0-indexed from the left of the codeword),
define the "locator number" X_k = α^{n−1−j_k} where n is the codeword length.
The error-locator polynomial is σ(x) = ∏_k (1 + X_k · x) and its roots lie at
x = X_k^{-1} = α^{−(n−1−j_k)}.

Chien search convention
------------------------
Iterating i = 0 … n−1 and evaluating σ at α^{−i} = α^{255−i} (interpreting
α^0 = α^{255} = 1), the root at iteration i corresponds to error position
n − 1 − i from the left.

Supported configurations (nsym parity symbols, t = nsym/2 correctable bytes)
----------------------------------------------------------------------
  nsym=2,  t=1  — MINIMAL tier
  nsym=4,  t=2  — REDUCED tier
  nsym=8,  t=4  — STANDARD tier
  nsym=16, t=8  — FULL tier

Usage
-----
>>> codec = RSCodec(nsym=8)
>>> cw = codec.encode(b"hello world TINSEL!")
>>> decoded, n_errors = codec.decode(cw)
>>> decoded == b"hello world TINSEL!"
True
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# GF(2^8) tables — primitive polynomial 0x11d
# ---------------------------------------------------------------------------

_GF_EXP: list[int] = [0] * 512
_GF_LOG: list[int] = [0] * 256

_x = 1
for _i in range(255):
    _GF_EXP[_i] = _x
    _GF_LOG[_x] = _i
    _x <<= 1
    if _x & 0x100:
        _x ^= 0x11d
# Duplicate to avoid mod reduction in multiply hot path
for _i in range(255, 512):
    _GF_EXP[_i] = _GF_EXP[_i - 255]


def _gf_mul(x: int, y: int) -> int:
    if x == 0 or y == 0:
        return 0
    return _GF_EXP[_GF_LOG[x] + _GF_LOG[y]]


def _gf_pow(x: int, power: int) -> int:
    """x^power in GF(2^8). For x=0 returns 0; power is taken mod 255."""
    if x == 0:
        return 0
    return _GF_EXP[(_GF_LOG[x] * power) % 255]


def _gf_inv(x: int) -> int:
    if x == 0:
        raise ZeroDivisionError("0 has no inverse in GF(2^8)")
    return _GF_EXP[255 - _GF_LOG[x]]


# ---------------------------------------------------------------------------
# GF(2^8) polynomial arithmetic (coefficients in HIGH-DEGREE-FIRST order)
# ---------------------------------------------------------------------------

def _poly_scale(p: list[int], s: int) -> list[int]:
    return [_gf_mul(c, s) for c in p]


def _poly_add(p: list[int], q: list[int]) -> list[int]:
    """Coefficient-wise XOR with zero-padding."""
    r = [0] * max(len(p), len(q))
    off_p = len(r) - len(p)
    off_q = len(r) - len(q)
    for i, v in enumerate(p):
        r[i + off_p] ^= v
    for i, v in enumerate(q):
        r[i + off_q] ^= v
    return r


def _poly_mul(p: list[int], q: list[int]) -> list[int]:
    r = [0] * (len(p) + len(q) - 1)
    for j, cj in enumerate(q):
        for i, ci in enumerate(p):
            r[i + j] ^= _gf_mul(ci, cj)
    return r


def _poly_eval(p: list[int], x: int) -> int:
    """Horner evaluation: p = [c_{d}, …, c_0] → c_d·x^d + … + c_0."""
    y = 0
    for c in p:
        y = _gf_mul(y, x) ^ c
    return y


# ---------------------------------------------------------------------------
# Generator polynomial g(x) = ∏_{i=0}^{nsym-1} (x + α^i)
# ---------------------------------------------------------------------------

def _rs_generator_poly(nsym: int) -> list[int]:
    g = [1]
    for i in range(nsym):
        g = _poly_mul(g, [1, _gf_pow(2, i)])
    return g


# ---------------------------------------------------------------------------
# Systematic encoding: append nsym parity bytes after the message
# ---------------------------------------------------------------------------

def _rs_encode_msg(msg: bytes, nsym: int) -> bytes:
    if len(msg) + nsym > 255:
        raise ValueError(f"Message too long: {len(msg)} + {nsym} > 255")
    gen = _rs_generator_poly(nsym)
    # Working buffer: message followed by nsym zeros (the parity slots)
    buf = list(msg) + [0] * nsym
    for i in range(len(msg)):
        if buf[i]:
            for j in range(1, len(gen)):
                buf[i + j] ^= _gf_mul(gen[j], buf[i])
    return bytes(list(msg) + buf[len(msg):])


# ---------------------------------------------------------------------------
# Syndrome computation S_i = R(α^i) for i = 0…nsym-1
# ---------------------------------------------------------------------------

def _rs_syndromes(msg: list[int], nsym: int) -> list[int]:
    return [_poly_eval(msg, _gf_pow(2, i)) for i in range(nsym)]


def _rs_clean(msg: list[int], nsym: int) -> bool:
    return all(s == 0 for s in _rs_syndromes(msg, nsym))


# ---------------------------------------------------------------------------
# Berlekamp-Massey: find error-locator polynomial σ(x)
# ---------------------------------------------------------------------------

def _rs_berlekamp_massey(synd: list[int]) -> list[int]:
    nsym = len(synd)
    err_loc = [1]
    old_loc = [1]
    for i in range(nsym):
        # Compute discrepancy δ = S_i + Σ_{j≥1} σ_j · S_{i-j}
        delta = synd[i]
        for j in range(1, len(err_loc)):
            delta ^= _gf_mul(err_loc[-(j + 1)], synd[i - j])
        old_loc = old_loc + [0]  # multiply by x (shift right)
        if delta != 0:
            if len(old_loc) > len(err_loc):
                new_loc = _poly_scale(old_loc, delta)
                old_loc = _poly_scale(err_loc, _gf_inv(delta))
                err_loc = new_loc
            err_loc = _poly_add(err_loc, _poly_scale(old_loc, delta))
    return err_loc


# ---------------------------------------------------------------------------
# Chien search: find roots of σ by evaluating at α^{-i} for i = 0…n-1
# ---------------------------------------------------------------------------

def _rs_chien_search(err_loc: list[int], nmess: int) -> list[int]:
    """Return error positions (0-indexed from left) by searching for roots of σ.

    We evaluate σ at α^{−i} = α^{255−i} for each i, exploiting the fact that
    a root at iteration i corresponds to error position nmess − 1 − i.
    """
    errs = len(err_loc) - 1
    err_pos: list[int] = []
    for i in range(nmess):
        # α^{255-i} with α^{255} = α^0 = 1 (since ord(α) = 255)
        alpha_inv_i = _GF_EXP[255 - i] if i != 0 else 1
        if _poly_eval(err_loc, alpha_inv_i) == 0:
            err_pos.append(nmess - 1 - i)
    if len(err_pos) != errs:
        raise ReedSolomonError(
            f"Chien search: expected {errs} roots, found {len(err_pos)}"
            " — too many errors to correct"
        )
    return err_pos


# ---------------------------------------------------------------------------
# Forney algorithm: compute error magnitudes
# ---------------------------------------------------------------------------

def _rs_forney(synd: list[int], err_loc: list[int], err_pos: list[int], nmess: int) -> list[int]:
    """Compute and apply error corrections using the Forney algorithm.

    Returns a corrected copy of the message coefficients (length nmess).
    """
    t = len(err_pos)
    # X_k = α^{n-1-pos_k} (locator numbers)
    X = [_GF_EXP[nmess - 1 - pos] for pos in err_pos]

    # Error evaluator polynomial Ω(x) = S(x)·σ(x) mod x^nsym
    # S is the syndrome polynomial (reversed to match polynomial convention)
    synd_poly = list(synd)             # S_i = coefficient of x^i (low-degree first)
    sig_poly = list(reversed(err_loc))  # convert from high-degree-first to low-degree-first
    omega_full = _poly_mul(synd_poly, sig_poly)
    # Keep only the first nsym terms (mod x^nsym in low-degree-first form)
    omega = omega_full[: len(synd)]

    msg = list(range(nmess))  # placeholder, fill below
    # We'll return corrections to apply
    corrections = [0] * nmess
    for k, (Xk, pos) in enumerate(zip(X, err_pos)):
        Xk_inv = _gf_inv(Xk)
        # Ω(X_k^{-1}) — evaluate low-degree-first polynomial
        omega_val = 0
        for j, c in enumerate(omega):
            omega_val ^= _gf_mul(c, _gf_pow(Xk_inv, j))
        # σ'(X_k^{-1}) — formal derivative: drop even-indexed terms (over GF(2))
        # σ'(x) = Σ_{j odd} σ_j (low-degree-first) evaluated at Xk_inv
        sigma_prime_val = 0
        for j in range(1, len(sig_poly), 2):
            sigma_prime_val ^= _gf_mul(sig_poly[j], _gf_pow(Xk_inv, j - 1))
        if sigma_prime_val == 0:
            raise ReedSolomonError("Forney: zero denominator — too many errors")
        # Magnitude: e_k = X_k · Ω(X_k^{-1}) / σ'(X_k^{-1})
        magnitude = _gf_mul(Xk, _gf_mul(omega_val, _gf_inv(sigma_prime_val)))
        corrections[pos] = magnitude
    return corrections


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

class ReedSolomonError(Exception):
    """Raised when RS decoding detects uncorrectable errors."""


class RSCodec:
    """Systematic Reed-Solomon codec over GF(2^8).

    Parameters
    ----------
    nsym:
        Number of parity/check symbols. Can correct up to ``nsym // 2``
        symbol (byte) errors.

    Examples
    --------
    >>> codec = RSCodec(nsym=8)
    >>> cw = codec.encode(b"TINSEL")
    >>> decoded, n_errors = codec.decode(cw)
    >>> assert decoded == b"TINSEL" and n_errors == 0
    """

    def __init__(self, nsym: int) -> None:
        if nsym < 2 or nsym % 2 != 0:
            raise ValueError("nsym must be a positive even integer ≥ 2")
        self.nsym = nsym
        self.t = nsym // 2  # max correctable symbol errors

    def encode(self, data: bytes) -> bytes:
        """Return the systematic codeword: data bytes followed by nsym parity bytes."""
        return _rs_encode_msg(data, self.nsym)

    def decode(self, codeword: bytes) -> tuple[bytes, int]:
        """Decode a (possibly corrupted) codeword.

        Returns
        -------
        tuple[bytes, int]
            ``(message, n_corrected)`` where n_corrected is the number of
            byte errors that were corrected.

        Raises
        ------
        ReedSolomonError
            If more than ``t = nsym // 2`` errors are present.
        """
        msg = list(codeword)
        if _rs_clean(msg, self.nsym):
            return bytes(msg[: -self.nsym]), 0

        synd = _rs_syndromes(msg, self.nsym)
        err_loc = _rs_berlekamp_massey(synd)
        n_errors = len(err_loc) - 1
        if n_errors > self.t:
            raise ReedSolomonError(
                f"Too many errors: detected {n_errors}, capacity {self.t}"
            )

        err_pos = _rs_chien_search(err_loc, len(msg))
        corrections = _rs_forney(synd, err_loc, err_pos, len(msg))
        for pos, magnitude in enumerate(corrections):
            msg[pos] ^= magnitude

        if not _rs_clean(msg, self.nsym):
            raise ReedSolomonError("Correction failed: residual syndrome non-zero")

        return bytes(msg[: -self.nsym]), n_errors
