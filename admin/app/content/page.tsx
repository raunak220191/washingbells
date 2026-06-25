"use client";
import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import api from "@/lib/api";
import { Plus, Trash2, Pencil, RefreshCw, Image, Star } from "lucide-react";

const LINK_TYPES = ["none","service","page","url"];

export default function ContentPage() {
  const [banners, setBanners] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"banners"|"testimonials">("banners");
  const [loading, setLoading] = useState(true);

  // Banner form
  const [showBannerForm, setShowBannerForm] = useState(false);
  const [bannerForm, setBannerForm] = useState({ title: "", image_url: "", link_type: "none", link_target: "" });
  const [editBanner, setEditBanner] = useState<any>(null);

  // Testimonial form
  const [showTestForm, setShowTestForm] = useState(false);
  const [testForm, setTestForm] = useState({ customer_name: "", text: "", rating: "5", city: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [bRes, tRes] = await Promise.all([
        api.get("/admin/banners"),
        api.get("/admin/testimonials"),
      ]);
      setBanners(bRes.data);
      setTestimonials(tRes.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreateBanner = async () => {
    if (!bannerForm.title) return;
    try {
      await api.post("/admin/banners", bannerForm);
      setShowBannerForm(false);
      setBannerForm({ title: "", image_url: "", link_type: "none", link_target: "" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const handleUpdateBanner = async () => {
    if (!editBanner) return;
    try {
      await api.put(`/admin/banners/${editBanner.id}`, editBanner);
      setEditBanner(null);
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const handleDeleteBanner = async (id: string, title: string) => {
    if (!confirm(`Delete banner "${title}"?`)) return;
    try { await api.delete(`/admin/banners/${id}`); load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const handleToggleBanner = async (id: string, active: boolean) => {
    try { await api.put(`/admin/banners/${id}`, { active: !active }); load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const handleCreateTestimonial = async () => {
    if (!testForm.customer_name || !testForm.text) return;
    try {
      await api.post("/admin/testimonials", { ...testForm, rating: parseInt(testForm.rating) });
      setShowTestForm(false);
      setTestForm({ customer_name: "", text: "", rating: "5", city: "" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  const handleDeleteTestimonial = async (id: string, name: string) => {
    if (!confirm(`Delete testimonial from "${name}"?`)) return;
    try { await api.delete(`/admin/testimonials/${id}`); load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <PageLayout title="Banners & Content">
      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab("banners")} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === "banners" ? "bg-amber-500 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
          <Image size={14} /> Promo Banners ({banners.length})
        </button>
        <button onClick={() => setActiveTab("testimonials")} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === "testimonials" ? "bg-amber-500 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
          <Star size={14} /> Testimonials ({testimonials.length})
        </button>
        <button onClick={load} className="ml-auto flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* ─── BANNERS ─── */}
      {activeTab === "banners" && (
        <>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">Home screen promotional banners. Shown in the carousel.</p>
            <button onClick={() => setShowBannerForm(true)} className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-400 transition-colors">
              <Plus size={15} /> Add Banner
            </button>
          </div>

          {showBannerForm && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4">
              <h3 className="font-bold text-amber-900 mb-3">New Banner</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Title *</label>
                  <input value={bannerForm.title} onChange={e => setBannerForm({...bannerForm, title: e.target.value})}
                    placeholder="20% Off This Weekend!" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Image URL</label>
                  <input value={bannerForm.image_url} onChange={e => setBannerForm({...bannerForm, image_url: e.target.value})}
                    placeholder="https://..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Link Type</label>
                  <select value={bannerForm.link_type} onChange={e => setBannerForm({...bannerForm, link_type: e.target.value})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                    {LINK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {bannerForm.link_type !== "none" && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">Link Target</label>
                    <input value={bannerForm.link_target} onChange={e => setBannerForm({...bannerForm, link_target: e.target.value})}
                      placeholder={bannerForm.link_type === "service" ? "dry-clean" : "https://..."} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateBanner} className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-400">Create Banner</button>
                <button onClick={() => setShowBannerForm(false)} className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading ? <div className="col-span-3 text-center py-12 text-gray-400">Loading...</div> :
            banners.map(banner => (
              <div key={banner.id} className={`bg-white rounded-xl border ${banner.active ? "border-gray-200" : "border-dashed border-gray-300"} shadow-sm overflow-hidden`}>
                {banner.image_url ? (
                  <img src={banner.image_url} alt={banner.title} className="w-full h-36 object-cover" onError={e => (e.currentTarget.style.display = "none")} />
                ) : (
                  <div className="w-full h-36 bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                    <span className="text-white font-bold text-lg text-center px-4">{banner.title}</span>
                  </div>
                )}
                <div className="p-4">
                  {editBanner?.id === banner.id ? (
                    <div className="space-y-2">
                      <input value={editBanner.title} onChange={e => setEditBanner({...editBanner, title: e.target.value})}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-amber-500" />
                      <input value={editBanner.image_url} onChange={e => setEditBanner({...editBanner, image_url: e.target.value})}
                        placeholder="Image URL" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-amber-500" />
                      <div className="flex gap-1.5">
                        <select value={editBanner.link_type} onChange={e => setEditBanner({...editBanner, link_type: e.target.value})}
                          className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500">
                          {LINK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input value={editBanner.link_target || ""} onChange={e => setEditBanner({...editBanner, link_target: e.target.value})}
                          placeholder="Target" className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500" />
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={handleUpdateBanner} className="flex-1 bg-amber-500 text-white py-1.5 rounded text-xs font-semibold hover:bg-amber-400">Save</button>
                        <button onClick={() => setEditBanner(null)} className="flex-1 border border-gray-200 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-50">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{banner.title}</p>
                          {banner.link_type !== "none" && <p className="text-xs text-amber-600 mt-0.5">→ {banner.link_type}: {banner.link_target}</p>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${banner.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {banner.active ? "Live" : "Hidden"}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => setEditBanner(banner)} className="flex-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 py-1.5 rounded font-semibold flex items-center justify-center gap-1 transition-colors">
                          <Pencil size={10} /> Edit
                        </button>
                        <button onClick={() => handleToggleBanner(banner.id, banner.active)} className="flex-1 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 py-1.5 rounded font-semibold transition-colors">
                          {banner.active ? "Hide" : "Show"}
                        </button>
                        <button onClick={() => handleDeleteBanner(banner.id, banner.title)} className="text-xs bg-red-100 text-red-700 hover:bg-red-200 px-2.5 py-1.5 rounded font-semibold transition-colors">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ─── TESTIMONIALS ─── */}
      {activeTab === "testimonials" && (
        <>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">Customer reviews shown on the home screen.</p>
            <button onClick={() => setShowTestForm(true)} className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-400 transition-colors">
              <Plus size={15} /> Add Testimonial
            </button>
          </div>

          {showTestForm && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4">
              <h3 className="font-bold text-amber-900 mb-3">New Testimonial</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Customer Name *</label>
                  <input value={testForm.customer_name} onChange={e => setTestForm({...testForm, customer_name: e.target.value})}
                    placeholder="Priya Sharma" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">City</label>
                  <input value={testForm.city} onChange={e => setTestForm({...testForm, city: e.target.value})}
                    placeholder="Ludhiana" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Review *</label>
                  <textarea value={testForm.text} onChange={e => setTestForm({...testForm, text: e.target.value})}
                    rows={2} placeholder="Amazing service, clothes came back spotless!" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Rating (1-5)</label>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(r => (
                      <button key={r} onClick={() => setTestForm({...testForm, rating: String(r)})}
                        className={`w-10 h-10 rounded-full font-bold text-sm transition-colors ${testForm.rating === String(r) ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-amber-100"}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateTestimonial} className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-400">Add Testimonial</button>
                <button onClick={() => setShowTestForm(false)} className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading ? <div className="col-span-3 text-center py-12 text-gray-400">Loading...</div> :
            testimonials.map(t => (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <Star key={s} size={14} className={s <= t.rating ? "text-amber-400 fill-amber-400" : "text-gray-200"} />)}</div>
                  <button onClick={() => handleDeleteTestimonial(t.id, t.customer_name)} className="text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-sm text-gray-700 italic mb-3">"{t.text}"</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold text-sm">
                    {t.customer_name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.customer_name}</p>
                    {t.city && <p className="text-xs text-gray-400">{t.city}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </PageLayout>
  );
}
