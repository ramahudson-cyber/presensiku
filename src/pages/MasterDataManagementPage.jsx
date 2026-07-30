import { useState, useEffect } from "react";
import { MasterService } from "../services/masterService";

export default function MasterDataManagementPage() {
  const [data, setData] = useState({ positions: [], roles: [], statuses: [] });

  const loadData = async () => {
    const [p, r, s] = await Promise.all([
      MasterService.getPositions(),
      MasterService.getRoles(),
      MasterService.getStatuses(),
    ]);
    setData({ positions: p.data, roles: r.data, statuses: s.data });
  };

  useEffect(() => { loadData(); }, []);

  const handleAdd = async (type, name) => {
    if (!name) return;
    if (type === 'position') await MasterService.addPosition(name);
    if (type === 'role') await MasterService.addRole(name);
    if (type === 'status') await MasterService.addStatus(name);
    loadData();
  };

  const handleDelete = async (type, id) => {
    if (type === 'position') await MasterService.deletePosition(id);
    if (type === 'role') await MasterService.deleteRole(id);
    if (type === 'status') await MasterService.deleteStatus(id);
    loadData();
  };

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-6">Kelola Master Data</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['positions', 'roles', 'statuses'].map(key => (
          <div key={key} className="bg-black/40 p-4 rounded-xl border border-white/10">
            <h2 className="capitalize font-bold mb-4">{key}</h2>
            <ul>
              {data[key]?.map(item => (
                <li key={item.id} className="flex justify-between py-2 border-b border-white/5">
                  {item.name}
                  <button onClick={() => handleDelete(key.slice(0,-1), item.id)} className="text-red-400">Hapus</button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <input type="text" id={`in-${key}`} className="bg-white/10 p-2 rounded w-full" placeholder="Tambah baru..." />
              <button onClick={() => {
                const name = document.getElementById(`in-${key}`).value;
                handleAdd(key.slice(0,-1), name);
                document.getElementById(`in-${key}`).value = '';
              }} className="bg-purple-600 px-4 py-2 rounded">Add</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
