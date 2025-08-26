import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { InventoryStats } from '../../../types/inventory';

interface RecentTransaction {
    transaction_id: number;
    transaction_type: string;
    transacted_date: string;
    reference_number: string;
    transaction_status: 'Pending' | 'Completed' | 'Cancelled';
}

interface DashboardChartsProps {
    inventoryStats: InventoryStats;
    chartTransactions: RecentTransaction[];
}

const COLORS = ['#4237C7', '#D97708', '#DF3938'];

const renderCustomizedLabel = ({ cx, cy, midAngle, outerRadius, percent, index, name }: any) => {
    // Always show label for all three statuses
    const percentage = (percent * 100).toFixed(0);
    // Calculate the position of the label
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 20; // Increase this value to push labels further out
    // Calculate endpoint of line
    const x2 = cx + radius * Math.cos(-midAngle * RADIAN);
    const y2 = cy + radius * Math.sin(-midAngle * RADIAN);
    // Calculate position of text
    const textAnchor = x2 > cx ? 'start' : 'end';
    const x3 = x2 + (x2 > cx ? 10 : -10); // Add some padding between line and text
    return (
        <g>
            {/* Straight line from pie to label */}
            <line
                x1={cx + (outerRadius * 0.95) * Math.cos(-midAngle * RADIAN)}
                y1={cy + (outerRadius * 0.95) * Math.sin(-midAngle * RADIAN)}
                x2={x2}
                y2={y2}
                stroke={COLORS[index]}
                strokeWidth={1}
            />
            {/* Label text */}
            <text
                x={x3}
                y={y2}
                textAnchor={textAnchor}
                fill={COLORS[index]}
                dominantBaseline="central"
                className="text-sm font-medium"
            >
                {`${name} ${percentage}%`}
            </text>
        </g>
    );
};

export default function DashboardCharts({ inventoryStats, chartTransactions }: DashboardChartsProps) {
    // Prepare data for pie chart
    const pieData = [
        { name: 'In Stock', value: inventoryStats.total_items - inventoryStats.low_stock - inventoryStats.out_of_stock },
        { name: 'Low Stock', value: inventoryStats.low_stock },
        { name: 'Out of Stock', value: inventoryStats.out_of_stock }
    ]; // Always show all three statuses

    // --- Transaction Trends: Show last 7 days, even if no transactions ---
    // Get last 7 days as date strings
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        return d.toLocaleDateString();
    });
    // Group transactions by date and count them
    const transactionsByDate = chartTransactions.reduce((acc: Record<string, number>, transaction) => {
        const date = new Date(transaction.transacted_date).toLocaleDateString();
        acc[date] = (acc[date] || 0) + 1;
        return acc;
    }, {});
    // Build lineData for last 7 days
    const lineData = last7Days.map(date => ({ date, count: transactionsByDate[date] || 0 }));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Inventory Status Chart */}
            <div className="bg-[#FCFBFC] border border-[#EBEAEA] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-[#2C2C2C] mb-4">Inventory Status</h2>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={renderCustomizedLabel}
                                outerRadius={100}
                                innerRadius={0}
                                fill="#8884d8"
                                dataKey="value"
                                startAngle={90}
                                endAngle={-270}
                            >
                                {pieData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                formatter={(value: number) => [`${value} items`, 'Quantity']}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Transaction Trends Chart */}
            <div className="bg-[#FCFBFC] border border-[#EBEAEA] rounded-xl p-6">
                <h2 className="text-lg font-semibold text-[#2C2C2C] mb-4">Transaction Trends</h2>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lineData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="count" stroke="#4237C7" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
} 