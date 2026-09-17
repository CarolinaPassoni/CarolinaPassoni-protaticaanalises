const fs = require('node:fs');
const path = require('node:path');

const patch = (relativePath, replacements) => {
  const filePath = path.join(process.cwd(), relativePath);
  let text = fs.readFileSync(filePath, 'utf8');
  let changed = 0;

  for (const { label, oldText, newText } of replacements) {
    if (text.includes(newText)) continue;
    if (!text.includes(oldText)) {
      console.warn(`[AUTOREFRESH_V6_8] Trecho não encontrado em ${relativePath}: ${label}`);
      continue;
    }
    text = text.replace(oldText, newText);
    changed += 1;
  }

  if (changed) fs.writeFileSync(filePath, text, 'utf8');
  console.log(`[AUTOREFRESH_V6_8] ${relativePath}: ${changed} ajuste(s) aplicado(s).`);
};

patch('src/components/MatchesModule.tsx', [
  {
    label: 'fetch silencioso',
    oldText: `  const fetchData = async () => {\n    try {\n      setLoading(true);`,
    newText: `  const fetchData = async (silent = false) => {\n    try {\n      if (!silent) setLoading(true);`,
  },
  {
    label: 'finalização silenciosa',
    oldText: `    } finally {\n      setLoading(false);\n    }\n  };\n\n  useEffect(() => {\n    fetchData();\n  }, []);`,
    newText: `    } finally {\n      if (!silent) setLoading(false);\n    }\n  };\n\n  useEffect(() => {\n    fetchData();\n    const refreshTimer = window.setInterval(() => fetchData(true), 60 * 1000);\n    return () => window.clearInterval(refreshTimer);\n  }, []);`,
  },
]);

patch('src/components/HomeDashboard.tsx', [
  {
    label: 'home silenciosa',
    oldText: `    const loadHomeData = async () => {\n      try {\n        setLoadingFeatured(true);`,
    newText: `    const loadHomeData = async (silent = false) => {\n      try {\n        if (!silent) setLoadingFeatured(true);`,
  },
  {
    label: 'home timer',
    oldText: `      } finally {\n        setLoadingFeatured(false);\n      }\n    };\n\n    loadHomeData();\n  }, []);`,
    newText: `      } finally {\n        if (!silent) setLoadingFeatured(false);\n      }\n    };\n\n    loadHomeData();\n    const refreshTimer = window.setInterval(() => loadHomeData(true), 90 * 1000);\n    return () => window.clearInterval(refreshTimer);\n  }, []);`,
  },
]);
