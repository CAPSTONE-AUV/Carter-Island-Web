'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import Header from '@/components/layout/Header';

// ----- Types -----
type DailyCount = {
  date: string;
  total: number;
};

// ----- Mock data -----
const mockDaily: DailyCount[] = [
  { date: '2025-09-11', total: 18 },
  { date: '2025-09-12', total: 22 },
  { date: '2025-09-13', total: 12 },
  { date: '2025-09-14', total: 26 },
  { date: '2025-09-15', total: 19 },
  { date: '2025-09-16', total: 31 },
  { date: '2025-09-17', total: 24 },
];

export default function AnalyticsPage() {
  const [data, setData] = useState<DailyCount[]>([]);

  useEffect(() => {
    setData(mockDaily);
  }, []);

  const totals = useMemo(() => {
    const sum = data.reduce((a, d) => a + d.total, 0);
    const avg = data.length ? Math.round((sum / data.length) * 10) / 10 : 0;
    const maxVal = data.length ? Math.max(...data.map(d => d.total)) : 0;
    const maxDate = data.length ? data.reduce((p, c) => (c.total > p.total ? c : p)).date : '';
    return { sum, avg, maxVal, maxDate };
  }, [data]);

  return (
    <div className="min-h-full">
      {/* Header */}
      <Header title="Analytics" emoji="📊" />

        <main className="p-0 lg:px-4 mt-4">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="px-6 py-2">
              <p className="text-xs text-gray-500">Total Ikan (∑)</p>
              <p className="text-2xl font-semibold">{totals.sum}</p>
              <p className="text-xs text-gray-500 mt-1">Dalam {data.length} hari</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="px-6 py-2">
              <p className="text-xs text-gray-500">Rata-rata / Hari</p>
              <p className="text-2xl font-semibold">{totals.avg}</p>
              <p className="text-xs text-gray-500 mt-1">Mean harian</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="px-6 py-2">
              <p className="text-xs text-gray-500">Hari Tertinggi</p>
              <p className="text-xl font-semibold">
                {data.length ? `${totals.maxVal} ikan` : '-'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data.length ? new Date(totals.maxDate).toLocaleDateString() : ''}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card className="h-[380px] border-0 shadow-sm mt-4">
          <CardContent className="px-4 h-full">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium mb-4">Grafik Harian (Total Ikan)</h3>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.map(d => ({ ...d, dlabel: new Date(d.date).toLocaleDateString() }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dlabel" interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </main>
      </div>
  );
}
