#!/usr/bin/env python3
"""Gera códigos de ativação da versão Pro do Note Bounce.

Uso:   python3 scripts/gerar_codigos_pro.py 10        (gera 10 códigos)
Cada código tem o formato XXXX-XXXX-XXXX e vale para a ativação em 1 aparelho (o app confere o código sozinho, sem internet).
Envie um código para cada pessoa que pagar. NÃO suba a lista de códigos para o GitHub.

O app e este script usam o mesmo segredo (PRO_SALT, dentro do index.html). Se você trocar o PRO_SALT, todos os códigos antigos deixam de valer.
"""
import os, re, secrets, sys

ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
M32 = 0xFFFFFFFF

def imul(a, b):
    return ((a & M32) * (b & M32)) & M32

def cyrb53(s, seed=0):
    h1 = (0xDEADBEEF ^ seed) & M32
    h2 = (0x41C6CE57 ^ seed) & M32
    for ch in s:
        c = ord(ch)
        h1 = imul(h1 ^ c, 2654435761)
        h2 = imul(h2 ^ c, 1597334677)
    h1 = imul(h1 ^ (h1 >> 16), 2246822507) ^ imul(h2 ^ (h2 >> 13), 3266489909)
    h2 = imul(h2 ^ (h2 >> 16), 2246822507) ^ imul(h1 ^ (h1 >> 13), 3266489909)
    h1 &= M32; h2 &= M32
    return 4294967296 * (2097151 & h2) + h1

def check(id_, salt):
    v = cyrb53(id_ + salt) % 1048576
    out = ""
    for _ in range(4):
        out = ALPHA[v % 32] + out
        v //= 32
    return out

def read_salt():
    html = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "index.html"), encoding="utf-8").read()
    return re.search(r"PRO_SALT\s*=\s*'([^']+)'", html).group(1)

if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    salt = read_salt()
    for _ in range(n):
        id_ = "".join(secrets.choice(ALPHA) for _ in range(8))
        c = id_ + check(id_, salt)
        print(f"{c[:4]}-{c[4:8]}-{c[8:]}")
