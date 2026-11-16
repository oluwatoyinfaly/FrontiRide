import sys, json
path = sys.argv[1].split(".")
d = json.load(sys.stdin)
try:
    for k in path:
        d = d[int(k)] if k.lstrip("-").isdigit() else d[k]
except (KeyError, IndexError):
    d = ""  # champ absent : valeur vide, pour pouvoir tester qu'il est caché
print(d if not isinstance(d, (dict, list)) else json.dumps(d, ensure_ascii=False))
