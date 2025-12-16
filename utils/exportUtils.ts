
import { BusinessData, ColumnLabelMap } from '../types';
import ExcelJS from 'exceljs';

/**
 * Génère le contenu HTML de la mini-app interactive
 */
export const getInteractiveHTMLContent = (data: BusinessData[], projectName: string, columnLabels: ColumnLabelMap) => {
    const jsonString = JSON.stringify(data).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
    const labelsString = JSON.stringify(columnLabels).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');

    // NOTE: On conserve le script CDN de xlsx ici car il est utilisé dans un fichier autonome
    // et ne pose pas de risque de sécurité pour l'application principale.
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dossier: ${projectName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js"></script>
  <style>
      body { font-family: 'Inter', sans-serif; background-color: #F8FAFC; color: #0F172A; }
      .cell-edit:hover { background-color: #F1F5F9; cursor: pointer; border-radius: 4px; }
      .cell-edit:focus { background-color: white; outline: 2px solid #6366f1; }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; border: 2px solid #F8FAFC; }
  </style>
</head>
<body class="h-screen flex flex-col overflow-hidden">
  <!-- HEADER -->
  <header class="bg-white border-b border-slate-200 h-16 shrink-0 flex items-center justify-between px-6 z-20 shadow-sm">
      <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2-2z"></path></svg>
          </div>
          <div>
              <h1 class="font-bold text-slate-900 leading-tight">${projectName}</h1>
              <p class="text-xs text-slate-500">Dossier Interactif • <span id="count">0</span> leads</p>
          </div>
      </div>
      <div class="flex items-center gap-4">
           <div class="relative group">
              <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <input type="text" id="search" placeholder="Filtrer..." class="pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 w-64 transition-all">
           </div>
           <button onclick="exportData()" class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md transition-all active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Sauvegarder (.xlsx)
           </button>
      </div>
  </header>

  <!-- TABLE -->
  <main class="flex-1 overflow-auto bg-white">
      <div class="min-w-full inline-block align-middle">
          <table class="min-w-full divide-y divide-slate-200">
              <thead class="bg-slate-50 sticky top-0 z-10">
                  <tr>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 z-20 border-r border-slate-200">Entreprise</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider" id="lbl-status">Statut</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider text-indigo-600 bg-indigo-50/50" id="lbl-custom">Memo</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider" id="lbl-cat">Catégorie</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider" id="lbl-addr">Adresse</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider" id="lbl-phone">Téléphone</th>
                      <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider" id="lbl-email">Lead Contact</th>
                  </tr>
              </thead>
              <tbody class="bg-white divide-y divide-slate-100" id="table-body">
                  <!-- JS INJECTED ROWS -->
              </tbody>
          </table>
      </div>
  </main>

  <script>
      let rawData = JSON.parse("${jsonString}");
      const labels = JSON.parse("${labelsString}");

      // Setup Labels
      document.getElementById('lbl-status').textContent = labels.status;
      document.getElementById('lbl-custom').textContent = labels.customField;
      document.getElementById('lbl-cat').textContent = labels.category;
      document.getElementById('lbl-addr').textContent = labels.address;
      document.getElementById('lbl-phone').textContent = labels.phone;
      document.getElementById('lbl-email').textContent = labels.email;

      const tableBody = document.getElementById('table-body');
      const countEl = document.getElementById('count');
      const searchInput = document.getElementById('search');

      function render(data) {
          tableBody.innerHTML = '';
          countEl.textContent = data.length;
          
          data.forEach((item, index) => {
              const tr = document.createElement('tr');
              tr.className = 'hover:bg-slate-50 transition-colors group';
              
              // DATA PREP
              const phone = item.phone && item.phone !== 'N/A' ? item.phone : (item.phones?.[0] || '');
              const email = item.email || (item.emails?.[0] || '');
              const dm = item.decisionMakers && item.decisionMakers.length > 0 ? item.decisionMakers[0] : null;

              // DECISION MAKER BADGE HTML
              let dmHtml = '';
              if(dm) {
                 dmHtml = \`<div class="flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 w-fit mb-1"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> \${dm.name}</div>\`;
              }

              tr.innerHTML = \`
                  <td class="px-6 py-4 whitespace-nowrap sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div class="text-sm font-semibold text-slate-900 cell-edit p-1" contenteditable="true" onblur="updateData(\${index}, 'name', this.innerText)">\${item.name}</div>
                      \${item.website ? \`<a href="\${item.website}" target="_blank" class="text-[10px] text-indigo-500 hover:underline flex items-center gap-1 mt-0.5">Website <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>\` : ''}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full \${item.status.toLowerCase().includes('ferm') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
                          \${item.status}
                      </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap bg-slate-50/30">
                      <div class="text-xs text-slate-600 cell-edit p-1 italic" contenteditable="true" onblur="updateData(\${index}, 'customField', this.innerText)">\${item.customField || '...'}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-xs text-slate-500">\${item.category || '-'}</td>
                  <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-xs text-slate-500 cell-edit p-1 max-w-[200px] truncate" title="\${item.address}" contenteditable="true" onblur="updateData(\${index}, 'address', this.innerText)">\${item.address}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-600">
                       <div class="cell-edit p-1" contenteditable="true" onblur="updateData(\${index}, 'phone', this.innerText)">\${phone}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-xs">
                      \${dmHtml}
                      <div class="font-mono text-slate-600 cell-edit p-1" contenteditable="true" onblur="updateData(\${index}, 'email', this.innerText)">\${email}</div>
                  </td>
              \`;
              tableBody.appendChild(tr);
          });
      }

      function updateData(index, field, value) {
          // Placeholder update function for interactivity within HTML export
      }

      searchInput.addEventListener('input', (e) => {
          const term = e.target.value.toLowerCase();
          const filtered = rawData.filter(item => 
              item.name.toLowerCase().includes(term) || 
              (item.email && item.email.toLowerCase().includes(term)) ||
              (item.address && item.address.toLowerCase().includes(term))
          );
          render(filtered);
      });

      window.exportData = function() {
          // Re-read data from TABLE to capture edits
          const rows = [];
          document.querySelectorAll('tbody tr').forEach(tr => {
              const cells = tr.querySelectorAll('td');
              rows.push({
                  "Entreprise": cells[0].querySelector('.cell-edit').innerText,
                  "Statut": cells[1].innerText.trim(),
                  "Memo": cells[2].innerText.trim(),
                  "Catégorie": cells[3].innerText.trim(),
                  "Adresse": cells[4].innerText.trim(),
                  "Téléphone": cells[5].innerText.trim(),
                  "Email": cells[6].querySelector('.font-mono').innerText.trim()
              });
          });

          const ws = XLSX.utils.json_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Leads_Modifies");
          XLSX.writeFile(wb, "${projectName}_edited.xlsx");
      };

      // Initial Render
      render(rawData);

  </script>
</body>
</html>
    `;
};

/**
 * Crée un Workbook Excel (ExcelJS)
 */
export async function createExcelWorkbook(data: BusinessData[], columnLabels: ColumnLabelMap): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leads');

    // Définir les colonnes, leurs en-têtes, leurs clés et leurs largeurs
    worksheet.columns = [
        { header: "Terme Recherché", key: "searchedTerm", width: 25 },
        { header: columnLabels.name, key: "name", width: 35 },
        { header: columnLabels.customField, key: "customField", width: 20 },
        { header: columnLabels.status, key: "status", width: 15 },
        { header: "Décideur (Nom)", key: "decisionMakerName", width: 20 },
        { header: "Poste (Contact)", key: "decisionMakerTitle", width: 25 },
        { header: "Email 1", key: "email1", width: 30 },
        { header: "Email 2", key: "email2", width: 30 },
        { header: "Email 3", key: "email3", width: 20 },
        { header: "Téléphone 1", key: "phone1", width: 15 },
        { header: "Téléphone 2", key: "phone2", width: 15 },
        { header: "Téléphone 3", key: "phone3", width: 15 },
        { header: "Site Web", key: "website", width: 30 },
        { header: "Facebook", key: "facebook", width: 20 },
        { header: "LinkedIn", key: "linkedin", width: 20 },
        { header: "Instagram", key: "instagram", width: 20 },
        { header: columnLabels.category, key: "category", width: 20 },
        { header: columnLabels.address, key: "address", width: 40 },
        { header: columnLabels.hours, key: "hours", width: 30 },
        { header: "Lien Maps", key: "sourceUri", width: 30 }
    ];

    // Mettre en gras la ligne d'en-tête
    worksheet.getRow(1).font = { bold: true };

    // Préparer et ajouter les lignes de données
    const rows = data.map(row => {
        const uniquePhones = Array.from(new Set(row.phones || (row.phone ? [row.phone] : [])));
        const uniqueEmails = Array.from(new Set(row.emails || (row.email ? [row.email] : [])));
        const dm = row.decisionMakers && row.decisionMakers.length > 0 ? row.decisionMakers[0] : null;

        const primaryEmail = uniqueEmails[0];
        const primaryContact = row.decisionMakers?.find(p => p.email && primaryEmail && p.email.toLowerCase() === primaryEmail.toLowerCase());

        return {
            searchedTerm: row.searchedTerm || "",
            name: row.name,
            customField: row.customField || "",
            status: row.status,
            decisionMakerName: dm?.name || "",
            decisionMakerTitle: primaryContact?.title || "",
            email1: uniqueEmails[0] || "",
            email2: uniqueEmails[1] || "",
            email3: uniqueEmails[2] || "",
            phone1: uniquePhones[0] || "",
            phone2: uniquePhones[1] || "",
            phone3: uniquePhones[2] || "",
            website: row.website || "",
            facebook: row.socials?.facebook || "",
            linkedin: row.socials?.linkedin || "",
            instagram: row.socials?.instagram || "",
            category: row.category || "",
            address: row.address || "",
            hours: row.hours || "",
            sourceUri: row.sourceUri || ""
        };
    });

    worksheet.addRows(rows);

    // Figer la première ligne
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    
    // Activer l'auto-filtre
    worksheet.autoFilter = {
      from: 'A1',
      to: { row: 1, column: worksheet.columns.length }
    };

    // Retourner le buffer du fichier
    return await workbook.xlsx.writeBuffer();
}

/**
 * Télécharge un fichier Excel
 */
export async function exportToExcel(data: BusinessData[], filename: string, columnLabels: ColumnLabelMap) {
    const buffer = await createExcelWorkbook(data, columnLabels);
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
};