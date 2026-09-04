const fs = require("fs");
let code = fs.readFileSync("src/views/Reports.jsx", "utf-8");

code = code.replace(
  /const \[openUser, setOpenUser\] = useState\(null\);/,
  `const [activeTab, setActiveTab] = useState("per_orang");\n  const [openUser, setOpenUser] = useState(null);`
);

const tabsHtml = `
      {/* TABS */}
      <div className="flex border-b border-[hsl(var(--hairline))] mb-4">
        {[{id: "ringkasan", label: "Ringkasan / Overview"}, {id: "per_orang", label: "Per Orang (Leaderboard)"}, {id: "data_cs", label: "Data CS"}].map(t => (
           <button 
             key={t.id} 
             onClick={() => setActiveTab(t.id)} 
             className={\`px-4 py-2 font-semibold text-sm border-b-2 transition-colors \${activeTab === t.id ? "border-[#0C66E4] text-[#0C66E4]" : "border-transparent text-slate-500 hover:text-slate-800"}\`}
           >
              {t.label}
           </button>
        ))}
      </div>
      
      {isLoading ? (
`;

code = code.replace(/\{isLoading \? \(/, tabsHtml);

fs.writeFileSync("src/views/Reports.jsx", code);
