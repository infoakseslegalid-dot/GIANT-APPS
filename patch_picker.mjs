import fs from 'fs'
const p = '/home/alvansyahwardhana/GIANT-APPS/src/components/RequirementPicker.jsx'
let content = fs.readFileSync(p, 'utf-8')

const origList = `        {filtered.map((r) => {
          const checked = selected.has(norm(r.text));
          return (
            <label
              key={r.text}
              className={\`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[hsl(var(--muted))] \${
                checked ? "bg-[#E9F2FF] dark:bg-[#0c66e4]/15" : ""
              }\`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(r.text)}
                className="mt-0.5 accent-[#0C66E4]"
              />
              <span className="min-w-0 flex-1">
                <span className="text-foreground">{r.text}</span>
                <span className="ml-1.5 text-[11px] text-3">
                  {r.custom ? "kustom" : r.templates.join(", ")}
                </span>
              </span>
              {r.custom && checked && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); toggle(r.text); }}
                  className="mt-0.5 shrink-0 rounded p-0.5 text-3 hover:bg-[hsl(var(--elevated))] hover:text-[#CA3521]"
                  aria-label={\`Hapus syarat \${r.text}\`}
                >
                  <X size={13} />
                </button>
              )}
            </label>
          );
        })}`

const newList = `        {filtered.map((r) => {
          const checked = selected.has(norm(r.text));
          if (r.custom) {
            return (
              <CustomReqRow
                key={\`custom-\${norm(r.text)}\`}
                r={r}
                checked={checked}
                toggle={toggle}
                remove={(text) => toggle(text)}
                rename={(oldText, newText) => {
                  const next = (value || []).map((v) => (norm(v) === norm(oldText) ? newText : v));
                  onChange(next);
                }}
              />
            );
          }
          return (
            <label
              key={\`tpl-\${norm(r.text)}\`}
              className={\`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[hsl(var(--muted))] \${
                checked ? "bg-[#E9F2FF] dark:bg-[#0c66e4]/15" : ""
              }\`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(r.text)}
                className="mt-0.5 accent-[#0C66E4]"
              />
              <span className="min-w-0 flex-1">
                <span className="text-foreground">{r.text}</span>
                <span className="ml-1.5 text-[11px] text-3">
                  {r.templates.join(", ")}
                </span>
              </span>
            </label>
          );
        })}`

content = content.replace(origList, newList)

const customComp = `

function CustomReqRow({ r, checked, toggle, remove, rename }) {
  const [val, setVal] = useState(r.text);

  return (
    <div
      className={\`flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[hsl(var(--muted))] \${
        checked ? "bg-[#E9F2FF] dark:bg-[#0c66e4]/15" : ""
      }\`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => toggle(r.text)}
        className="mt-1.5 accent-[#0C66E4] cursor-pointer shrink-0"
      />
      <div className="min-w-0 flex-1 flex items-center">
        <input 
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => { 
            const t = val.trim();
            if (t && t !== r.text) rename(r.text, t); 
            else setVal(r.text);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.target.blur();
            }
          }}
          className="text-foreground bg-transparent border-b border-transparent hover:border-[hsl(var(--hairline))] focus:border-[#0c66e4] focus:outline-none px-1 w-full text-sm transition-colors"
        />
        <span className="ml-1.5 text-[11px] text-3 shrink-0">kustom</span>
      </div>
      {checked && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); remove(r.text); }}
          className="mt-1 shrink-0 rounded p-0.5 text-3 hover:bg-[hsl(var(--elevated))] hover:text-[#CA3521]"
          aria-label={\`Hapus syarat kustom \${r.text}\`}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
`
content += customComp

fs.writeFileSync(p, content)
