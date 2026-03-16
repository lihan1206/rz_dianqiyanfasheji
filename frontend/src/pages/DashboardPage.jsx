import { useEffect, useState } from "react";
import { Card, Col, Row, Skeleton, Statistic } from "antd";
import { http } from "../api/client";

const metrics = [
  { key: "projectTotal", title: "项目总数" },
  { key: "drawingTotal", title: "图纸数量" },
  { key: "bomTotal", title: "BOM 数量" },
  { key: "componentTotal", title: "元器件总数" },
  { key: "pendingReview", title: "待审批任务" }
];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await http.get("/dashboard/summary");
      setData(res.data || {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  return (
    <Row gutter={[16, 16]}>
      {metrics.map((item) => (
        <Col xs={24} md={12} lg={8} key={item.key}>
          <Card bordered={false} className="panel-card">
            <Statistic title={item.title} value={Number(data[item.key] || 0)} />
          </Card>
        </Col>
      ))}
    </Row>
  );
}
