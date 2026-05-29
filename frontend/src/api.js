const BASE='/api';
async function req(path,opts={}){
  const token = localStorage.getItem('it_manager_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = token;
  
  const res=await fetch(BASE+path,{headers,...opts,body:opts.body?JSON.stringify(opts.body):undefined});
  if (res.status === 401) {
    localStorage.removeItem('it_manager_token');
    window.location.reload();
  }
  const data=await res.json();
  if(!data.success) throw new Error(data.message);
  return data.data;
}
export const api={
  // Dashboard
  dashboard:()=>req('/dashboard'),
  // Assets
  listAssets:(p)=>req('/assets?'+new URLSearchParams(p)),
  getAsset:(id)=>req('/assets/'+id),
  createAsset:(d)=>req('/assets',{method:'POST',body:d}),
  updateAsset:(id,d)=>req('/assets/'+id,{method:'PUT',body:d}),
  deleteAsset:(id)=>req('/assets/'+id,{method:'DELETE'}),
  // Asset history & comments
  getAssetHistory:(id)=>req('/assets/'+id+'/history'),
  addComment:(id,d)=>req('/assets/'+id+'/comment',{method:'POST',body:d}),
  // Maintenance
  createMaintenance:(aid,d)=>req('/assets/'+aid+'/maintenance',{method:'POST',body:d}),
  updateMaintenance:(mid,d)=>req('/maintenance/'+mid,{method:'PUT',body:d}),
  // Licenses
  listLicenses:()=>req('/licenses'),
  getLicense:(id)=>req('/licenses/'+id),
  createLicense:(d)=>req('/licenses',{method:'POST',body:d}),
  updateLicense:(id,d)=>req('/licenses/'+id,{method:'PUT',body:d}),
  deleteLicense:(id)=>req('/licenses/'+id,{method:'DELETE'}),
  getLicenseHistory:(id)=>req('/licenses/'+id+'/history'),
  // Budget
  listBudget:(y)=>req('/budget?year='+(y||new Date().getFullYear())),
  createBudget:(d)=>req('/budget',{method:'POST',body:d}),
  // Inventories
  listInventories:()=>req('/inventories'),
  getInventory:(id)=>req('/inventories/'+id),
  createInventory:(d)=>req('/inventories',{method:'POST',body:d}),
  checkInventoryItem:(iid,itemId,d)=>req('/inventories/'+iid+'/items/'+itemId,{method:'PUT',body:d}),
  closeInventory:(iid,d)=>req('/inventories/'+iid+'/close',{method:'PUT',body:d}),
  deleteInventory:(id)=>req('/inventories/'+id,{method:'DELETE'}),
  // Other
  inventorySummary:()=>req('/inventory/summary'),
  departments:()=>req('/departments'),
  vendors:()=>req('/vendors'),
  listUsers:()=>req('/users'),
  createUser:(d)=>req('/users',{method:'POST',body:d}),
  deleteUser:(id)=>req('/users/'+id,{method:'DELETE'}),
  uploadImage: async (file) => {
    const token = localStorage.getItem('it_manager_token');
    const headers = {};
    if (token) headers['Authorization'] = token;

    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.data;
  },
  importAssets: async (file) => {
    const token = localStorage.getItem('it_manager_token');
    const headers = {};
    if (token) headers['Authorization'] = token;

    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/assets/import', { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.data;
  },
  login: (username, password) => req('/auth/login', { method: 'POST', body: { username, password } }),
  me: () => req('/auth/me'),
  // Telecom (Mobile Lines & Audits)
  listMobileLines:(p)=>req('/telecom/lines?'+new URLSearchParams(p)),
  getMobileLine:(id)=>req('/telecom/lines/'+id),
  createMobileLine:(d)=>req('/telecom/lines',{method:'POST',body:d}),
  updateMobileLine:(id,d)=>req('/telecom/lines/'+id,{method:'PUT',body:d}),
  deleteMobileLine:(id)=>req('/telecom/lines/'+id,{method:'DELETE'}),
  getMobileLineHistory:(id)=>req('/telecom/lines/'+id+'/history'),
  addMobileLineComment:(id,d)=>req('/telecom/lines/'+id+'/comments',{method:'POST',body:d}),
  listTelecomAudits:()=>req('/telecom/audits'),
  createTelecomAudit:(d)=>req('/telecom/audits',{method:'POST',body:d}),
  getTelecomAudit:(id)=>req('/telecom/audits/'+id),
  updateTelecomAuditItem:(aid,itemId,d)=>req('/telecom/audits/'+aid+'/items/'+itemId,{method:'PUT',body:d}),
  closeTelecomAudit:(aid)=>req('/telecom/audits/'+aid+'/close',{method:'POST'}),
  importVivoInvoice: async (aid, file) => {
    const token = localStorage.getItem('it_manager_token');
    const headers = {};
    if (token) headers['Authorization'] = token;
    
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`/api/telecom/audits/${aid}/import-vivo`, { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.data;
  },
  importMobileLines: async (file) => {
    const token = localStorage.getItem('it_manager_token');
    const headers = {};
    if (token) headers['Authorization'] = token;
    
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/telecom/lines/import', { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.data;
  }
};
export default api;
