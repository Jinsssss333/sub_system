import { useState } from 'react';
import { Sparkles, Check, Box } from 'lucide-react';
import { Product, initialProducts } from '../../api/mockData';
import { formatINR } from '../../utils/formatters';

interface ProductsPageProps {
  products?: Product[];
}

export function ProductsPage({ products = initialProducts }: ProductsPageProps) {
  const [productList] = useState<Product[]>(products);
  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredProducts = productList.filter((p) => {
    if (filterType === 'ALL') return true;
    return p.type === filterType;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Products & Catalog</h1>
            <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200">
              Admin Console
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage subscription catalog items, tiered pricing, and premium add-on variants.
          </p>
        </div>

        {/* Hackathon Callout Badge */}
        <div className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-800 px-3.5 py-2 rounded-xl text-xs font-medium shadow-sm">
          <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            Featured: <strong>Odoo Edition (+₹560.00)</strong> variant enabled
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {['ALL', 'SOFTWARE', 'ADD_ON', 'STORAGE'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterType(tab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterType === tab
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab === 'ALL' ? 'All Products' : tab}
          </button>
        ))}
      </div>

      {/* Products Grid / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-6">Product Details</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-right">Base Sales Price</th>
                <th className="py-3.5 px-4 text-right">Cost Price</th>
                <th className="py-3.5 px-6">Configured Variants</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/60 transition">
                  {/* Name and notes */}
                  <td className="py-4 px-6">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 mt-0.5">
                        <Box className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900">{product.name}</div>
                        {product.notes && (
                          <div className="text-xs text-slate-500 mt-0.5 max-w-sm">{product.notes}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="py-4 px-4">
                    <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono font-medium">
                      {product.type}
                    </span>
                  </td>

                  {/* Sales Price */}
                  <td className="py-4 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                    {formatINR(product.salesPrice)}
                  </td>

                  {/* Cost Price */}
                  <td className="py-4 px-4 text-right font-mono text-slate-500">
                    {formatINR(product.costPrice)}
                  </td>

                  {/* Variants (highlighting Odoo Edition) */}
                  <td className="py-4 px-6">
                    {product.variants.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {product.variants.map((v) => {
                          const isOdoo = v.value.toLowerCase().includes('odoo');
                          return (
                            <span
                              key={v.id}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                isOdoo
                                  ? 'bg-gradient-to-r from-amber-100 to-amber-200 text-amber-900 border border-amber-300 shadow-xs ring-1 ring-amber-300/50'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {isOdoo && <Sparkles className="w-3 h-3 text-amber-700" />}
                              <span>{v.value}</span>
                              <span className="font-mono text-[11px] text-amber-800">
                                ({v.extraPrice > 0 ? `+${formatINR(v.extraPrice)}` : 'Included'})
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">No variants</span>
                    )}
                  </td>

                  {/* Active Status */}
                  <td className="py-4 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        product.active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
