import { useState, useEffect } from "react";
import { MasterService } from "../services/masterService";
import { Pencil, Trash2, Plus, X } from "lucide-react";

const SECTIONS = [
  { key: "positions", label: "Jabatan", icon: "💼" },
  { key: "roles", label: "Role", icon: "🔑" },
  { key: "statuses", label: "Status Kepegawaian", icon: "📋" },
];

export default function MasterDataManagementPage() {
  const [data, setData] = useState({ positions: [], roles: [], statuses: [] });
  const [editItem, setEditItem] = useState(null); // { type, id, name }
  const [newName, setNewName] = useState("");

  const loadData = async () => {
    const [p, r, s] = await Promise.all([
      MasterService.getPositions(),
      MasterService.getRoles(),
      MasterService.getStatuses(),
    ]);
    setData({ positions: p.data || [], roles: r.data || [], statuses: s.data || [] });
  };

  useEffect(() => { loadData(); }, []);

  const handleAdd = async (type) => {
    if (!newName.trim()) return;
    if (type === "position") await MasterService.addPosition(newName.trim());
    if (type === "role") await MasterService.addRole(newName.trim());
    if (type === "status") await MasterService.addStatus(newName.trim());
    setNewName("");
    loadData();
  };

  const handleUpdate = async () => {
    if (!editItem || !editItem.name.trim()) return;
    if (editItem.type === "position") await MasterService.updatePosition(editItem.id, editItem.name.trim());
    if (editItem.type === "role") await MasterService.updateRole(editItem.id, editItem.name.trim());
    if (editItem.type === "status") await MasterService.updateStatus(editItem.id, editItem.name.trim());
    setEditItem(null);
    loadData();
  };

  const handleDelete = async (type, id) => {
    if (!confirm("Yakin hapus?")) return;
    if (type === "position") await MasterService.deletePosition(id);
    if (type === "role") await MasterService.deleteRole(id);
    if (type === "status") await MasterService.deleteStatus(id);
    loadData();
  };

  return (
    <div className="p-6 text-white max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Kelola Master Data</h1>
      <p className="text-slate-mist text-sm mb-6">Tambah, edit, atau hapus Jabatan, Role, dan Status Kepegawaian</p>

      <div className="space-y-8">
        {SECTIONS.map((section) => {
          const items = data[section.key] || [];
          const type = section.key === "positions" ? "position" : section.key === "roles" ? "role" : "status";

          return (
            <div key={section.key} className="bg-black/40 rounded-xl border border-white/10 overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <span>{section.icon}</span> {section.label}
                </h2>
                <span className="text-xs text-slate-mist">{items.length} item</span>
              </div>

              {/* List */}
              <ul className="divide-y divide-white/5">
                {items.length === 0 ? (
                  <li className="px-5 py-8 text-center text-slate-mist text-sm">Belum ada data</li>
                ) : (
                  items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.03]">
                      {editItem?.id === item.id && editItem?.type === type ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            value={editItem.name}
                            onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm flex-1"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") handleUpdate(); if (e.key === "Escape") setEditItem(null); }}
                          />
                          <button onClick={handleUpdate} className="text-green-400 hover:text-green-300 text-sm font-medium">Simpan</button>
                          <button onClick={() => setEditItem(null)} className="text-slate-mist hover:text-white"><X size={16} /></button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium">{item.name}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditItem({ type, id: item.id, name: item.name })}
                              className="p-1.5 text-sky-300 hover:bg-sky-500/15 rounded-lg transition-all" title="Edit">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDelete(type, item.id)}
                              className="p-1.5 text-rose-300 hover:bg-rose-500/15 rounded-lg transition-all" title="Hapus">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))
                )}
              </ul>

              {/* Add form */}
              {(!editItem || editItem.type !== type) && (
                <div className="px-5 py-3 border-t border-white/5 flex gap-2">
                  <input
                    placeholder={`Tambah ${section.label} baru...`}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAdd(type); }}
                    className="bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm flex-1"
                  />
                  <button onClick={() => handleAdd(type)}
                    className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-all">
                    <Plus size={16} /> Tambah
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}