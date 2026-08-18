import sys, json
path = sys.argv[1].split(".")
d = json.load(sys.stdin)
for k in path:
    d = d[int(k)] if k.lstrip("-").isdigit() else d[k]
print(d if not isinstance(d, (dict, list)) else json.dumps(d, ensure_ascii=False))
