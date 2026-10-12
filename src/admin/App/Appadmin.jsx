import  { useEffect, useRef, useState } from 'react';
import './Appadmin.css';
import Navbar from '../../components/Navbar';
import ApexCharts from 'apexcharts';
import { useCachedApiGet } from '../../contexts/DataCacheContext';

const Appadmin = () => {

  const getAuth = () => {
    const saved = localStorage.getItem('auth');
    return saved ? JSON.parse(saved) : null;
  };

  const auth = getAuth();
  const { id, username } = auth || {}; 

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const chartRef = useRef(null);
  const chartContainerRef = useRef(null);

  const { data: countData } = useCachedApiGet('/count');
  const { data: serviceData } = useCachedApiGet('/sum-price');
  const { data: priceData } = useCachedApiGet('/price');

  const machineCount = countData?.total_customers ?? 0;
  const customerCount = serviceData?.total_customers ?? 0;
  const totalIncome = (serviceData?.total_income ?? 0).toLocaleString('vi-VN') + ' VND';

  const renderChart = (categories, series) => {
    if (!chartContainerRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const options = {
      chart: { type: 'line', height: 350, animations: { enabled: false } },
      stroke: { curve: 'smooth' },
      series,
      xaxis: { categories },
      title: { text: 'Doanh thu các tháng', align: 'center', style: { color: '#d81b60' } },
      yaxis: { title: { text: 'Doanh thu' }, labels: { formatter: (val) => val.toLocaleString('vi-VN') } },
      tooltip: { y: { formatter: (value) => value.toLocaleString('vi-VN') + ' VND' } },
      colors: ['#d81b60'],
    };

    chartRef.current = new ApexCharts(chartContainerRef.current, options);
    chartRef.current.render();
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    if (!Array.isArray(priceData) || priceData.length === 0) return;

    const sorted = [...priceData].sort((a, b) => {
      if (a.year === b.year) return a.month - b.month;
      return a.year - b.year;
    });

    const categories = sorted.map((item) =>
      `${item.year}-${String(item.month).padStart(2, '0')}`
    );
    const revenueData = sorted.map((item) => Number(item.total_revenue) || 0);
    renderChart(categories, [{ name: 'Doanh thu', data: revenueData }]);

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [priceData]);

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

return (
  <>
    <Navbar
      sidebarCollapsed={sidebarCollapsed}
      onToggleSidebar={toggleSidebar}
      id={id}
      username={username}
    />

    <div className={`appadmin-main-container ${sidebarCollapsed ? 'appadmin-sidebar-collapsed' : ''}`}>
      <div className="appadmin-title">
        <h2 className="appadmin-overview-title">TỔNG QUAN</h2>
      </div>

      <div className="appadmin-stats-row">
        <div className="appadmin-stat-card">
          <div className="appadmin-card-box">
            <div className="appadmin-card-content">
              <div className="appadmin-widget-data">
                <div className="appadmin-machine-count">{machineCount}</div>
                <div className="appadmin-label">Số máy</div>
              </div>
              <div className="appadmin-widget-icon">
                <div className="appadmin-icon appadmin-icon-machine">
                  <i className="icon-copy bi bi-emoji-smile-fill" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="appadmin-stat-card">
          <div className="appadmin-card-box">
            <div className="appadmin-card-content">
              <div className="appadmin-widget-data">
                <div className="appadmin-customer-count">{customerCount}</div>
                <div className="appadmin-label">Số khách hàng</div>
              </div>
              <div className="appadmin-widget-icon">
                <div className="appadmin-icon appadmin-icon-customer">
                  <i className="icon-copy fa fa-users" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="appadmin-stat-card">
          <div className="appadmin-card-box">
            <div className="appadmin-card-content">
              <div className="appadmin-widget-data">
                <div className="appadmin-income">{totalIncome}</div>
                <div className="appadmin-label">Tổng thu nhập</div>
              </div>
              <div className="appadmin-widget-icon">
                <div className="appadmin-icon appadmin-icon-income">
                  <i className="icon-copy fa fa-money" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="appadmin-chart-box">
        <h4 className="appadmin-chart-title">Biểu đồ doanh thu hàng tháng</h4>
        <div ref={chartContainerRef} className="appadmin-chart-container" />
      </div>
    </div>
  </>
);
};

export default Appadmin;