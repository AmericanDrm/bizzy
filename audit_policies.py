import json
from collections import defaultdict

with open('/tmp/cc-agent/63747567/.claude/projects/-tmp-cc-agent-63747567-project/cea3276a-5cae-47eb-aa8c-8ea403f3d53c/tool-results/mcp-supabase-execute_sql-1777216546923.txt') as f:
    raw = f.read()
outer = json.loads(raw)
text = json.loads(outer[0]['text'])
start = text.find('\n[')
end = text.rfind(']')
inner = text[start+1:end+1]
policies = json.loads(inner)

by_table = defaultdict(list)
for p in policies:
    by_table[p['tablename']].append(p)

for tbl in sorted(by_table.keys()):
    print(f"\n{'='*60}")
    print(f"TABLE: {tbl}")
    for p in sorted(by_table[tbl], key=lambda x: x['policyname']):
        print(f"  [{p['cmd']}] {p['policyname']} | permissive={p['permissive']} | roles={p['roles']}")
        if p['qual']:
            q = p['qual'].replace('\n', ' ').replace('   ', ' ')
            print(f"    USING:      {q}")
        if p['with_check']:
            wc = p['with_check'].replace('\n', ' ').replace('   ', ' ')
            print(f"    WITH CHECK: {wc}")
