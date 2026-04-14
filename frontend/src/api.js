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
  createLicense:(d)=>req('/licenses',{method:'POST',body:d}),
  deleteLicense:(id)=>req('/licenses/'+id,{method:'DELETE'}),
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
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.data;
  },
  importAssets: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/assets/import', { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.data;
  },
  login: (username, password) => req('/auth/login', { method: 'POST', body: { username, password } }),
  me: () => req('/auth/me')
};
export default api;
