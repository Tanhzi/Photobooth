import  { useEffect, useRef, useState } from 'react';
import Navbar from '../../components/Navbar';
import ApexCharts from 'apexcharts';
import './Revenue.css';
import { apiGet } from '../../api';

const Revenue = () => {
    const chartRef = useRef(null);

    // Sidebar
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Auth
    const getAuth = () => {
        const saved = localStorage.getItem('auth');
        return saved ? JSON.parse(saved) : null;
    };
    const [auth, ] = useState(getAuth());
    const { id: id_admin, username } = auth || {};

    // ===== GLOBAL CLIENT FILTER =====
    const [allClients, setAllClients] = useState([]);
    const [clientNames, setClientNames] = useState({}); // id_client -> tên máy (BE trả client_name)
    const [selectedClients, setSelectedClients] = useState([]); // 🌟 DUY NHẤT

    // ===== FILTER STATES =====
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYearForMonth, setSelectedYearForMonth] = useState(new Date().getFullYear());
    const [selectedQuarter, setSelectedQuarter] = useState(1);
    const [selectedYearForQuarter, setSelectedYearForQuarter] = useState(new Date().getFullYear());
    const [selectedYearForYear, setSelectedYearForYear] = useState(new Date().getFullYear());

    // ===== DATA STATES =====
    const [dateRangeData, setDateRangeData] = useState([]);
    const [monthData, setMonthData] = useState([]);
    const [quarterData, setQuarterData] = useState([]);
    const [yearData, setYearData] = useState([]);

    // ===== FETCH CHART DATA (with client filter on frontend) =====
    const fetchChartData = async () => {
        if (!id_admin) return;
        try {
            const response = await apiGet('/summary');
            let data = await response.json();

            // Ghi tên máy từ client_name (BE join users) để bảng + bộ lọc hiển thị tên thay vì số
            const names = {};
            data.forEach(item => {
                if (item.client_name) names[item.id_client] = item.client_name;
            });
            if (Object.keys(names).length > 0) {
                setClientNames(prev => ({ ...prev, ...names }));
            }

            // 🔥 Lọc theo selectedClients ở frontend
            if (selectedClients.length > 0) {
                data = data.filter(item => selectedClients.includes(item.id_client));
            }

            const clients = [...new Set(data.map(item => item.id_client))];
            setAllClients(clients);

            const grouped = {};
            data.forEach(item => {
                const monthKey = `${item.year}-${String(item.month).padStart(2, '0')}`;
                if (!grouped[monthKey]) grouped[monthKey] = {};
                if (!grouped[monthKey][item.cuts]) grouped[monthKey][item.cuts] = 0;
                grouped[monthKey][item.cuts] += Number(item.total_revenue);
            });

            const months = Object.keys(grouped).sort();
            const uniqueCuts = Array.from(new Set(data.map(item => item.cuts))).sort((a, b) => a - b);
            const series = uniqueCuts.map(cut => ({
                name: `Cut ${cut}`,
                data: months.map(month => grouped[month][cut] || 0)
            }));

            renderChart(months, series);
        } catch (error) {
            console.error("Error fetching chart ", error);
        }
    };

    // ===== FETCH FUNCTIONS (with frontend filtering) =====
    const fetchDateRangeData = async () => {
        if (!fromDate || !toDate || !id_admin) return;
        try {
            const response = await apiGet(`/range?from_date=${fromDate}&to_date=${toDate}`);
            let data = await response.json();

            if (selectedClients.length > 0) {
                data = data.filter(item => selectedClients.includes(item.id_client));
            }

            setDateRangeData(data);
        } catch (error) {
            console.error("Error fetching date range ", error);
        }
    };

    const fetchMonthData = async () => {
        if (!id_admin) return;
        try {
            const response = await apiGet(`/month?month=${selectedMonth}&year=${selectedYearForMonth}`);
            let data = await response.json();

            if (selectedClients.length > 0) {
                data = data.filter(item => selectedClients.includes(item.id_client));
            }

            setMonthData(data);
        } catch (error) {
            console.error("Error fetching month ", error);
        }
    };

    const fetchQuarterData = async () => {
        if (!id_admin) return;
        try {
            const response = await apiGet(`/quarter?quarter=${selectedQuarter}&year=${selectedYearForQuarter}`);
            let data = await response.json();

            if (selectedClients.length > 0) {
                data = data.filter(item => selectedClients.includes(item.id_client));
            }

            setQuarterData(data);
        } catch (error) {
            console.error("Error fetching quarter ", error);
        }
    };

    const fetchYearData = async () => {
        if (!id_admin) return;
        try {
            const response = await apiGet(`/year?year=${selectedYearForYear}`);
            let data = await response.json();

            if (selectedClients.length > 0) {
                data = data.filter(item => selectedClients.includes(item.id_client));
            }

            setYearData(data);
        } catch (error) {
            console.error("Error fetching year ", error);
        }
    };

    // ===== RENDER CHART =====
    const renderChart = (categories, series) => {
        const options = {
            chart: { type: 'line', height: 350 },
            stroke: { curve: 'smooth' },
            series,
            xaxis: { categories },
            title: {
                text: 'Biểu đồ doanh thu hàng tháng theo từng Cuts',
                align: 'center',
                style: { color: '#d81b60', fontWeight: '600' }
            },
            yaxis: {
                title: { text: 'Doanh thu' },
                labels: { formatter: (val) => val.toLocaleString('vi-VN') }
            },
            tooltip: {
                y: { formatter: (value) => value.toLocaleString('vi-VN') + ' VND' }
            },
            colors: ['#d81b60', '#f06292', '#f48fb1', '#ec407a']
        };

        if (chartRef.current) chartRef.current.destroy();
        const chart = new ApexCharts(document.querySelector("#chart5"), options);
        chartRef.current = chart;
        chart.render();
    };

    // ===== RENDER TABLE =====
    const renderTableWithTotal = (data, noDataMessage) => {
        if (!data || data.length === 0) {
            return (
                <tr>
                    <td colSpan="4" className="revenue-no-data">{noDataMessage}</td>
                </tr>
            );
        }

        const totalRevenueSum = data.reduce((acc, row) => acc + Number(row.total_revenue), 0);
        const totalDiscountSum = data.reduce((acc, row) => acc + Number(row.discount_price), 0);
        const realRevenue = totalRevenueSum - totalDiscountSum;

        return (
            <>
                {data.map((row, index) => (
                    <tr key={`${row.id_client}-${row.cuts}-${index}`}>
                        <td>{row.client_name || row.id_client}</td>
                        <td>{row.cuts}</td>
                        <td>{Number(row.discount_price).toLocaleString('vi-VN')}</td>
                        <td>{Number(row.total_revenue).toLocaleString('vi-VN')}</td>
                    </tr>
                ))}
                <tr className="revenue-total-row">
                    <td colSpan="2" className="text-start fw-bold">Tổng tiền giảm</td>
                    <td className="fw-bold">{totalDiscountSum.toLocaleString('vi-VN')}</td>
                    <td></td>
                </tr>
                <tr className="revenue-total-row">
                    <td colSpan="3" className="text-start fw-bold">Tổng doanh thu</td>
                    <td className="fw-bold">{totalRevenueSum.toLocaleString('vi-VN')}</td>
                </tr>
                <tr className="revenue-total-row">
                    <td colSpan="3" className="text-start fw-bold">Doanh thu thực tế</td>
                    <td className="fw-bold">{realRevenue.toLocaleString('vi-VN')}</td>
                </tr>
            </>
        );
    };

    // ===== GLOBAL CLIENT FILTER UI =====
    const toggleClient = (client) => {
        if (selectedClients.includes(client)) {
            setSelectedClients(selectedClients.filter(c => c !== client));
        } else {
            setSelectedClients([...selectedClients, client]);
        }
    };

    const toggleSelectAll = () => {
        if (selectedClients.length === allClients.length) {
            setSelectedClients([]);
        } else {
            setSelectedClients([...allClients]);
        }
    };

    // ===== EFFECTS =====

    // Set selectedClients = allClients lần đầu khi có dữ liệu
    useEffect(() => {
        if (allClients.length > 0 && selectedClients.length === 0) {
            setSelectedClients([...allClients]);
        }
    }, [allClients]);

    useEffect(() => {
        if (id_admin) {
            fetchChartData();
        }
        return () => {
            if (chartRef.current) chartRef.current.destroy();
        };
    }, [id_admin, selectedClients]);

    // Đóng dropdown khi click ngoài
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsClientDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (fromDate && toDate && id_admin) fetchDateRangeData();
    }, [fromDate, toDate, id_admin, selectedClients]);

    useEffect(() => {
        if (id_admin) fetchMonthData();
    }, [selectedMonth, selectedYearForMonth, id_admin, selectedClients]);

    useEffect(() => {
        if (id_admin) fetchQuarterData();
    }, [selectedQuarter, selectedYearForQuarter, id_admin, selectedClients]);

    useEffect(() => {
        if (id_admin) fetchYearData();
    }, [selectedYearForYear, id_admin, selectedClients]);

    return (
        <>
            <Navbar
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebar={toggleSidebar}
                id={id_admin}
                username={username}
            />

            <div className={`revenue-main-container ${sidebarCollapsed ? 'revenue-sidebar-collapsed' : ''}`}>
                <div className="revenue-report-box">
                    <h1>Báo Cáo Doanh Thu</h1>

                    {/* 🔥 BỘ LỌC TỔNG THEO MÁY */}
                    <div className="revenue-global-client-filter">
                        <label className="revenue-filter-label">Chọn máy:</label>
                        <div className="revenue-client-dropdown" ref={dropdownRef}>
                            <div
                                className="revenue-client-tags"
                                onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                            >
                                {selectedClients.length === 0 ? (
                                    <span className="revenue-placeholder">Chưa chọn máy nào</span>
                                ) : selectedClients.length === allClients.length ? (
                                    <span>Tất cả máy ({allClients.length})</span>
                                ) : (
                                    <span>{selectedClients.length} máy đã chọn</span>
                                )}
                                <span className="revenue-dropdown-arrow">▼</span>
                            </div>

                            {isClientDropdownOpen && (
                                <div className="revenue-client-options">
                                    <div
                                        className={`revenue-client-option ${selectedClients.length === allClients.length ? 'revenue-selected' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleSelectAll();
                                        }}
                                    >
                                        <strong>Tất cả</strong>
                                    </div>
                                    {allClients.map(client => (
                                        <div
                                            key={client}
                                            className={`revenue-client-option ${selectedClients.includes(client) ? 'revenue-selected' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleClient(client);
                                            }}
                                        >
                                            {clientNames[client] || `Máy ${client}`}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <ul className="nav nav-tabs">
                        <li className="nav-item">
                            <button className="nav-link active" data-bs-toggle="tab" data-bs-target="#dateRange">
                                Từ ngày - Đến ngày
                            </button>
                        </li>
                        <li className="nav-item">
                            <button className="nav-link" data-bs-toggle="tab" data-bs-target="#month">
                                Theo Tháng
                            </button>
                        </li>
                        <li className="nav-item">
                            <button className="nav-link" data-bs-toggle="tab" data-bs-target="#quarter">
                                Theo Quý
                            </button>
                        </li>
                        <li className="nav-item">
                            <button className="nav-link" data-bs-toggle="tab" data-bs-target="#year">
                                Theo Năm
                            </button>
                        </li>
                    </ul>

                    <div className="tab-content mt-4">
                        {/* Tab: Date Range */}
                        <div className="tab-pane fade show active" id="dateRange">
                            <div className="revenue-filters-row">
                                <div>
                                    <label className="revenue-filter-label">Từ ngày</label>
                                    <input
                                        type="date"
                                        className="revenue-date-input"
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="revenue-filter-label">Đến ngày</label>
                                    <input
                                        type="date"
                                        className="revenue-date-input"
                                        value={toDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="revenue-table-wrapper">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Máy (ID)</th>
                                            <th>Cuts</th>
                                            <th>Tổng tiền giảm</th>
                                            <th>Doanh thu (VNĐ)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {renderTableWithTotal(dateRangeData, "Không có dữ liệu")}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Tab: Month */}
                        <div className="tab-pane fade" id="month">
                            <div className="revenue-filters-row">
                                <div>
                                    <label className="revenue-filter-label">Chọn Tháng</label>
                                    <select
                                        className="revenue-select"
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                    >
                                        {Array.from({ length: 12 }, (_, i) => (
                                            <option key={i} value={i + 1}>Tháng {i + 1}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="revenue-filter-label">Chọn Năm</label>
                                    <select
                                        className="revenue-select"
                                        value={selectedYearForMonth}
                                        onChange={(e) => setSelectedYearForMonth(Number(e.target.value))}
                                    >
                                        {Array.from({ length: 5 }, (_, i) => {
                                            const year = new Date().getFullYear() - i;
                                            return <option key={i} value={year}>{year}</option>;
                                        })}
                                    </select>
                                </div>
                            </div>
                            <div className="revenue-table-wrapper">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Máy (ID)</th>
                                            <th>Cuts</th>
                                            <th>Tổng tiền giảm</th>
                                            <th>Doanh thu (VNĐ)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {renderTableWithTotal(monthData, "Không có dữ liệu")}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Tab: Quarter */}
                        <div className="tab-pane fade" id="quarter">
                            <div className="revenue-filters-row">
                                <div>
                                    <label className="revenue-filter-label">Chọn Quý</label>
                                    <select
                                        className="revenue-select"
                                        value={selectedQuarter}
                                        onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                                    >
                                        <option value={1}>Quý 1</option>
                                        <option value={2}>Quý 2</option>
                                        <option value={3}>Quý 3</option>
                                        <option value={4}>Quý 4</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="revenue-filter-label">Chọn Năm</label>
                                    <select
                                        className="revenue-select"
                                        value={selectedYearForQuarter}
                                        onChange={(e) => setSelectedYearForQuarter(Number(e.target.value))}
                                    >
                                        {Array.from({ length: 5 }, (_, i) => {
                                            const year = new Date().getFullYear() - i;
                                            return <option key={i} value={year}>{year}</option>;
                                        })}
                                    </select>
                                </div>
                            </div>
                            <div className="revenue-table-wrapper">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Máy (ID)</th>
                                            <th>Cuts</th>
                                            <th>Tổng tiền giảm</th>
                                            <th>Doanh thu (VNĐ)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {renderTableWithTotal(quarterData, "Không có dữ liệu")}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Tab: Year */}
                        <div className="tab-pane fade" id="year">
                            <div className="revenue-filters-row">
                                <div>
                                    <label className="revenue-filter-label">Chọn Năm</label>
                                    <select
                                        className="revenue-select"
                                        value={selectedYearForYear}
                                        onChange={(e) => setSelectedYearForYear(Number(e.target.value))}
                                    >
                                        {Array.from({ length: 5 }, (_, i) => {
                                            const year = new Date().getFullYear() - i;
                                            return <option key={i} value={year}>{year}</option>;
                                        })}
                                    </select>
                                </div>
                            </div>
                            <div className="revenue-table-wrapper">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Máy (ID)</th>
                                            <th>Cuts</th>
                                            <th>Tổng tiền giảm</th>
                                            <th>Doanh thu (VNĐ)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {renderTableWithTotal(yearData, "Không có dữ liệu")}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="revenue-chart-box">
                    <h4>Biểu đồ doanh thu hàng tháng theo từng Cuts</h4>
                    <div id="chart5" />
                </div>
            </div>
        </>
    );
};

export default Revenue;