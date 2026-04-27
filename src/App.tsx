import { useState, useMemo, useRef } from 'react';
import { parsedData, SalesRecord } from './data';
import { MetricCard } from './components/MetricCard';
import { Card } from './components/Card';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { CreditCard, DollarSign, Package, ShoppingCart, Filter, Calendar, Download, FileText, FileSpreadsheet, Grip, LayoutGrid, Eye, EyeOff, Upload, Sparkles, X } from 'lucide-react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import Papa from 'papaparse';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';

const ResponsiveGridLayout = WidthProvider(Responsive);

const COLORS = ['#1f2937', '#4b5563', '#9ca3af', '#d1d5db', '#e5e7eb'];
const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#a855f7', '#3b82f6'];

const WIDGET_NAMES: Record<string, string> = {
  'm-revenue': 'Total Revenue',
  'm-orders': 'Total Orders',
  'm-avg': 'Avg Order Value',
  'm-top': 'Top Product',
  'c-revenue': 'Revenue Over Time',
  'c-payment': 'Sales by Payment Method',
  'c-products': 'Top Products',
  'c-recent': 'Recent Orders'
};

const initialLayouts = {
  lg: [
    { i: 'm-revenue', x: 0, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { i: 'm-orders', x: 3, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { i: 'm-avg', x: 6, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { i: 'm-top', x: 9, y: 0, w: 3, h: 3, minW: 2, minH: 2 },
    { i: 'c-revenue', x: 0, y: 3, w: 8, h: 9, minW: 4, minH: 6 },
    { i: 'c-payment', x: 8, y: 3, w: 4, h: 9, minW: 3, minH: 6 },
    { i: 'c-products', x: 0, y: 12, w: 6, h: 9, minW: 4, minH: 6 },
    { i: 'c-recent', x: 6, y: 12, w: 6, h: 9, minW: 4, minH: 6 }
  ],
  md: [
    { i: 'm-revenue', x: 0, y: 0, w: 5, h: 3 },
    { i: 'm-orders', x: 5, y: 0, w: 5, h: 3 },
    { i: 'm-avg', x: 0, y: 3, w: 5, h: 3 },
    { i: 'm-top', x: 5, y: 3, w: 5, h: 3 },
    { i: 'c-revenue', x: 0, y: 6, w: 10, h: 8 },
    { i: 'c-payment', x: 0, y: 14, w: 10, h: 8 },
    { i: 'c-products', x: 0, y: 22, w: 10, h: 8 },
    { i: 'c-recent', x: 0, y: 30, w: 10, h: 8 }
  ]
};

export default function App() {
  const [appData, setAppData] = useState<SalesRecord[]>(parsedData);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [selectedProduct, setSelectedProduct] = useState<string>('All');
  const [selectedPayment, setSelectedPayment] = useState<string>('All');

  const products = useMemo(() => Array.from(new Set(appData.map(d => d.product))), [appData]);
  const paymentMethods = useMemo(() => Array.from(new Set(appData.map(d => d.paymentMethod))), [appData]);

  const filteredData = useMemo(() => {
    return appData.filter((record) => {
      if (selectedProduct !== 'All' && record.product !== selectedProduct) return false;
      if (selectedPayment !== 'All' && record.paymentMethod !== selectedPayment) return false;
      if (dateRange.start && record.date < dateRange.start) return false;
      if (dateRange.end && record.date > dateRange.end) return false;
      return true;
    });
  }, [appData, selectedProduct, selectedPayment, dateRange]);

  // Key Metrics
  const totalRevenue = filteredData.reduce((sum, r) => sum + r.price, 0);
  const totalOrders = filteredData.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  // Group by Date for Line Chart
  const revenueByDate = useMemo(() => {
    const grouped = filteredData.reduce((acc: Record<string, number>, curr) => {
      acc[curr.date] = (acc[curr.date] || 0) + curr.price;
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredData]);

  // Group by Product for Bar Chart
  const salesByProduct = useMemo(() => {
    const grouped = filteredData.reduce((acc: Record<string, number>, curr) => {
      acc[curr.product] = (acc[curr.product] || 0) + curr.price;
      return acc;
    }, {});
    const sorted = Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return sorted;
  }, [filteredData]);

  const topProduct = salesByProduct.length > 0 ? salesByProduct[0].name : "N/A";

  // Group by Payment Method for Pie Chart
  const salesByPayment = useMemo(() => {
    const grouped = filteredData.reduce((acc: Record<string, number>, curr) => {
      acc[curr.paymentMethod] = (acc[curr.paymentMethod] || 0) + curr.price;
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const recentOrders = useMemo(() => {
    return [...filteredData].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  }, [filteredData]);

  const dashboardRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [layouts, setLayouts] = useState(initialLayouts);
  const [exporting, setExporting] = useState(false);
  
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [insights, setInsights] = useState("");
  const [insightsLoading, setInsightsLoading] = useState(false);
  const prevDataLength = useRef(0);

  const [visibleWidgets, setVisibleWidgets] = useState<Record<string, boolean>>({
    'm-revenue': true, 'm-orders': true, 'm-avg': true, 'm-top': true,
    'c-revenue': true, 'c-payment': true, 'c-products': true, 'c-recent': true
  });
  const [showSettings, setShowSettings] = useState(false);

  const toggleWidget = (key: string) => {
    setVisibleWidgets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const fetchInsights = async () => {
    setIsInsightsOpen(true);
    // Refresh insights when new data is uploaded or if empty
    if (insights && !insightsLoading && filteredData.length === prevDataLength.current) return;
    
    prevDataLength.current = filteredData.length;
    setInsightsLoading(true);
    setInsights('');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const summaryText = `Total Revenue: ${totalRevenue}\nTotal Orders: ${totalOrders}\nAverage Order Value: ${avgOrderValue}\nTop Product: ${topProduct}\n` + 
        `Sales By Payment: ${JSON.stringify(salesByPayment)}\nSales By Product: ${JSON.stringify(salesByProduct.slice(0, 5))}\n` +
        `Revenue By Date: ${JSON.stringify(revenueByDate)}`;

      const response = await ai.models.generateContentStream({
        model: "gemini-3.1-pro-preview",
        contents: `Please write a succinct and high-level business summary based on the following sales metrics. Focus on key trends and major insights. Keep the prose very brief, punchy and readable. Make it bold, modern, and write in markdown: ${summaryText}`
      });

      for await (const chunk of response) {
        setInsights(prev => prev + chunk.text);
      }
    } catch (e: any) {
      console.error(e);
      setInsights("Failed to load insights. " + (e.message || "Make sure your API key is correctly configured."));
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<any>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const newData: SalesRecord[] = results.data.map(row => {
          const findVal = (keys: string[]) => {
            const rawKey = Object.keys(row).find(k => keys.some(key => k.toLowerCase().includes(key.toLowerCase())));
            return rawKey ? row[rawKey] : '';
          };
          
          const orderNumber = findVal(['order']) || 'N/A';
          const product = findVal(['product', 'item']) || 'Unknown Product';
          const priceRaw = findVal(['price', 'amount', 'total']);
          const price = parseFloat(priceRaw.replace(/[^0-9.-]+/g, "")) || 0;
          const dateRaw = findVal(['date', 'time']);
          
          let dateStr = new Date().toISOString().split('T')[0];
          if (dateRaw) {
            try {
               const d = new Date(dateRaw);
               if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
            } catch (e) {}
          }
          
          const paymentMethod = findVal(['payment', 'method', 'type']) || 'Unknown';
          
          return { orderNumber, product, price, date: dateStr, paymentMethod };
        });
        
        setAppData(newData);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const exportCSV = () => {
    const header = ['Order Number', 'Product', 'Price', 'Date', 'Payment Method'].join(',');
    const rows = filteredData.map(r => `${r.orderNumber},"${r.product}",${r.price},${r.date},${r.paymentMethod}`);
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales_data.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (!dashboardRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, { 
        scale: 2, 
        backgroundColor: '#09090b',
        useCORS: true
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('dashboard_report.pdf');
    } catch (e) {
      console.error("Failed to export PDF", e);
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="min-h-screen pb-12 bg-[#09090b] text-[#fafafa] font-sans">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-[#09090b]/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Sales Dashboard</h1>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          
          <div className="flex items-center space-x-2 mr-2">
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 px-3 py-1.5 rounded-md border border-indigo-500/30 transition-colors cursor-pointer"
              title="Upload CSV Data"
            >
              <Upload className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider hidden sm:inline">Upload CSV</span>
            </button>
            <button 
              onClick={fetchInsights} 
              className="flex items-center gap-2 bg-fuchsia-600/20 hover:bg-fuchsia-600/30 text-fuchsia-400 px-3 py-1.5 rounded-md border border-fuchsia-500/30 transition-colors cursor-pointer"
              title="AI Insights"
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider hidden sm:inline">AI Insights</span>
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowSettings(!showSettings)} 
                className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-md border border-zinc-700 transition-colors cursor-pointer"
                title="Customize Layout"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider hidden sm:inline">Widgets</span>
              </button>
              {showSettings && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-2 bg-zinc-800/50 border-b border-zinc-800 text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                      Toggle Widgets
                    </div>
                    <div className="p-2 space-y-1">
                      {Object.keys(WIDGET_NAMES).map(key => (
                        <button
                          key={key}
                          onClick={() => toggleWidget(key)}
                          className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-zinc-800 rounded text-sm text-zinc-300 transition-colors"
                        >
                          <span className="truncate">{WIDGET_NAMES[key]}</span>
                          {visibleWidgets[key] ? (
                            <Eye className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <button 
              onClick={exportCSV} 
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-md border border-zinc-700 transition-colors cursor-pointer"
              title="Download CSV"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider hidden sm:inline">CSV</span>
            </button>
            <button 
              onClick={exportPDF} 
              disabled={exporting}
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-md border border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
              title="Download PDF"
            >
              <FileText className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider hidden sm:inline">{exporting ? 'Exporting...' : 'PDF'}</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800 focus-within:ring-2 ring-zinc-700 transition-all">
            <Filter className="w-4 h-4 text-zinc-500" />
            <select 
              className="bg-transparent border-none outline-none text-zinc-300 w-32 cursor-pointer font-medium text-[11px] uppercase tracking-wider"
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
            >
              <option value="All">All Products</option>
              {products.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="flex items-center space-x-2 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800 focus-within:ring-2 ring-zinc-700 transition-all">
            <CreditCard className="w-4 h-4 text-zinc-500" />
            <select 
              className="bg-transparent border-none outline-none text-zinc-300 w-36 cursor-pointer font-medium text-[11px] uppercase tracking-wider"
              value={selectedPayment}
              onChange={(e) => setSelectedPayment(e.target.value)}
            >
              <option value="All">All Payments</option>
              {paymentMethods.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 sm:px-6 pt-8 space-y-8" ref={dashboardRef}>
        
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={40}
          onLayoutChange={(currentLayout, allLayouts) => setLayouts(allLayouts as any)}
          draggableHandle=".drag-handle"
          isBounded={true}
        >
          {/* Key Metrics */}
          {visibleWidgets['m-revenue'] && (
            <div key="m-revenue" className="h-full">
              <MetricCard 
                className="h-full"
                title="Total Revenue" 
                value={formatCurrency(totalRevenue)} 
                icon={<div className="drag-handle cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300"><Grip className="w-4 h-4 flex-shrink-0" /></div>} 
              />
            </div>
          )}
          {visibleWidgets['m-orders'] && (
            <div key="m-orders" className="h-full">
              <MetricCard 
                className="h-full"
                title="Total Orders" 
                value={totalOrders} 
                icon={<div className="drag-handle cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300"><Grip className="w-4 h-4 flex-shrink-0" /></div>} 
              />
            </div>
          )}
          {visibleWidgets['m-avg'] && (
            <div key="m-avg" className="h-full">
              <MetricCard 
                className="h-full"
                title="Avg Order Value" 
                value={formatCurrency(avgOrderValue)} 
                icon={<div className="drag-handle cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300"><Grip className="w-4 h-4 flex-shrink-0" /></div>} 
              />
            </div>
          )}
          {visibleWidgets['m-top'] && (
            <div key="m-top" className="h-full">
              <MetricCard 
                className="h-full"
                title="Top Product" 
                value={totalOrders === 0 ? "N/A" : topProduct.length > 15 ? topProduct.substring(0,12) + "..." : topProduct} 
                icon={<div className="drag-handle cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300"><Grip className="w-4 h-4 flex-shrink-0" /></div>} 
              />
            </div>
          )}

          {visibleWidgets['c-revenue'] && (
            <div key="c-revenue" className="h-full">
            <Card className="h-full" title={
              <div className="flex items-center gap-2">
                <div className="drag-handle cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300"><Grip className="w-4 h-4" /></div>
                Revenue Over Time
              </div>
            }>
              {revenueByDate.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <LineChart data={revenueByDate} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => format(parseISO(val), 'MMM d')}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#71717a', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                      dy={10}
                    />
                    <YAxis 
                      tickFormatter={(val) => `$${val}`}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#71717a', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                      dx={-10}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                      labelFormatter={(label) => format(parseISO(label as string), 'MMM d, yyyy')}
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fafafa', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                      itemStyle={{ color: '#e4e4e7' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#6366f1" 
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: "#6366f1", stroke: "#09090b", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-500">No data available</div>
              )}
            </Card>
          </div>
          )}

          {visibleWidgets['c-payment'] && (
          <div key="c-payment" className="h-full">
            <Card className="h-full" title={
              <div className="flex items-center gap-2">
                <div className="drag-handle cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300"><Grip className="w-4 h-4" /></div>
                Sales by Payment Method
              </div>
            }>
              {salesByPayment.length > 0 ? (
                <ResponsiveContainer width="100%" height="80%" minWidth={0} minHeight={0}>
                  <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <Pie
                      data={salesByPayment}
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="80%"
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                      onClick={(data) => {
                        setSelectedPayment(prev => prev === data.name ? 'All' : data.name);
                      }}
                      className="cursor-pointer"
                    >
                      {salesByPayment.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={PIE_COLORS[index % PIE_COLORS.length]} 
                          className="transition-opacity hover:opacity-80"
                          opacity={selectedPayment === 'All' || selectedPayment === entry.name ? 1 : 0.4}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fafafa', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                      itemStyle={{ color: '#e4e4e7' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[80%] items-center justify-center text-zinc-500">No data available</div>
              )}
              {salesByPayment.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-auto">
                  {salesByPayment.map((entry, i) => (
                    <div 
                      key={entry.name} 
                      onClick={() => setSelectedPayment(prev => prev === entry.name ? 'All' : entry.name)}
                      className={`flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest cursor-pointer px-2 py-1 rounded-md transition-colors ${
                        (selectedPayment === 'All' || selectedPayment === entry.name) ? 'text-zinc-300 bg-zinc-800/50' : 'text-zinc-600'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {entry.name}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
          )}

          {visibleWidgets['c-products'] && (
          <div key="c-products" className="h-full">
            <Card className="h-full flex flex-col" title={
              <div className="flex flex-1 items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="drag-handle cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300"><Grip className="w-4 h-4" /></div>
                  Top Products
                </div>
                {selectedProduct !== 'All' && (
                  <button 
                    onClick={() => setSelectedProduct('All')}
                    className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition-colors"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            }>
              {salesByProduct.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={salesByProduct.slice(0, 5)} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                    <XAxis 
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `$${val}`}
                      tick={{ fill: '#71717a', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#a1a1aa', fontSize: 11 }}
                      width={160}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      cursor={{ fill: '#27272a' }}
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fafafa', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                      itemStyle={{ color: '#e4e4e7' }}
                    />
                    <Bar 
                      dataKey="value" 
                      radius={[0, 4, 4, 0]} 
                      barSize={24}
                      onClick={(data) => {
                        setSelectedProduct(prev => prev === data.name ? 'All' : data.name);
                      }}
                      className="cursor-pointer"
                    >
                      {
                        salesByProduct.slice(0, 5).map((entry, index) => (
                          <Cell 
                            cursor="pointer" 
                            fill={(selectedProduct === 'All' || selectedProduct === entry.name) ? '#6366f1' : '#3f3f46'} 
                            key={`cell-${index}`} 
                            className="transition-colors hover:opacity-80"
                          />
                        ))
                      }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-500">No data available</div>
              )}
            </Card>
          </div>
          )}

          {visibleWidgets['c-recent'] && (
          <div key="c-recent" className="h-full">
            <Card className="h-full flex flex-col" title={
              <div className="flex items-center gap-2">
                <div className="drag-handle cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300"><Grip className="w-4 h-4" /></div>
                Recent Orders
              </div>
            }>
              <div className="-mx-6 border-t border-zinc-800/50 flex-1 overflow-x-auto min-h-0 relative h-full">
                <div className="absolute inset-0 overflow-y-auto">
                  {recentOrders.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                      <thead className="text-[10px] text-zinc-500 sticky top-0 uppercase tracking-widest bg-zinc-900 shadow-sm z-10">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Order</th>
                          <th className="px-6 py-3 font-semibold">Product</th>
                          <th className="px-6 py-3 font-semibold">Date</th>
                          <th className="px-6 py-3 font-semibold text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs divide-y divide-zinc-800/50">
                        {recentOrders.map((order, i) => (
                          <tr key={`${order.orderNumber}-${i}`} className="hover:bg-zinc-800/20 transition-colors">
                            <td className="px-6 py-3 font-mono text-zinc-300">{order.orderNumber}</td>
                            <td className="px-6 py-3 text-zinc-400 truncate max-w-[200px]" title={order.product}>{order.product}</td>
                            <td className="px-6 py-3 text-zinc-500 font-mono">{format(parseISO(order.date), 'MMM d, yyyy')}</td>
                            <td className="px-6 py-3 font-mono text-emerald-400 text-right">{formatCurrency(order.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-zinc-500 text-sm h-full flex items-center justify-center">No recent orders</div>
                  )}
                </div>
              </div>
            </Card>
          </div>
          )}
        </ResponsiveGridLayout>
      </main>

      {/* AI Insights Modal */}
      {isInsightsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm bg-black/50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-2 text-fuchsia-400">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-semibold text-lg tracking-tight">AI Insights</h3>
              </div>
              <button 
                onClick={() => setIsInsightsOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-md hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-zinc-300">
              {insightsLoading && !insights ? (
                <div className="flex items-center justify-center h-40 space-x-3 text-zinc-500">
                  <div className="w-5 h-5 border-2 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin"></div>
                  <span className="font-medium animate-pulse">Analyzing dashboard data...</span>
                </div>
              ) : (
                <div className="markdown-body text-sm leading-relaxed space-y-4">
                  <Markdown>{insights}</Markdown>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
