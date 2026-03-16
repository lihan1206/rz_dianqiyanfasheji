import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag
} from "antd";
import { z } from "zod";
import { http } from "../api/client";
import { reviewStatusLabelMap, reviewStatusOptions } from "../utils/labels";
import { validateOrToast } from "../utils/validation";

const createSchema = z.object({
  drawingId: z.number({ invalid_type_error: "请选择图纸" }),
  reviewerId: z.number({ invalid_type_error: "请选择审核人" }),
  comment: z.string().optional().or(z.literal(""))
});

export default function ReviewsPage() {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [users, setUsers] = useState([]);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [reviewRes, drawingRes, userRes] = await Promise.all([
        http.get("/reviews"),
        http.get("/drawings"),
        http.get("/users")
      ]);
      setReviews(reviewRes.data || []);
      setDrawings(drawingRes.data || []);
      setUsers(userRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    const values = await form.validateFields();
    const parsed = validateOrToast(createSchema, values);
    if (!parsed) return;

    await http.post("/reviews", parsed);
    setOpen(false);
    form.resetFields();
    await load();
  };

  const updateStatus = async (record, status) => {
    await http.patch(`/reviews/${record.id}`, {
      status,
      comment: record.comment || ""
    });
    await load();
  };

  const columns = [
    { title: "图纸", render: (_, record) => record.drawing?.name || "-" },
    { title: "提交人", render: (_, record) => record.submitter?.name || "-" },
    { title: "审核人", render: (_, record) => record.reviewer?.name || "-" },
    {
      title: "状态",
      dataIndex: "status",
      render: (status) => {
        const color = status === "APPROVED" ? "success" : status === "REJECTED" ? "error" : "processing";
        return <Tag color={color}>{reviewStatusLabelMap[status] || status}</Tag>;
      }
    },
    { title: "意见", dataIndex: "comment", render: (value) => value || "-" },
    {
      title: "操作",
      render: (_, record) =>
        record.status === "PENDING" ? (
          <Space>
            <Button size="small" type="primary" onClick={() => updateStatus(record, "APPROVED")}>
              通过
            </Button>
            <Button size="small" danger onClick={() => updateStatus(record, "REJECTED")}>
              驳回
            </Button>
          </Space>
        ) : (
          "-"
        )
    }
  ];

  return (
    <Card
      bordered={false}
      className="panel-card"
      title="设计协同与审批流程"
      extra={
        <Button type="primary" onClick={() => setOpen(true)}>
          发起审批
        </Button>
      }
    >
      <Table rowKey="id" loading={loading} columns={columns} dataSource={reviews} pagination={{ pageSize: 8 }} />

      <Modal title="发起审批" open={open} onCancel={() => setOpen(false)} onOk={submit} okText="提交" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item label="图纸" name="drawingId" rules={[{ required: true, message: "请选择图纸" }]}> 
            <Select options={drawings.map((item) => ({ label: `${item.name}（V${item.version}）`, value: item.id }))} />
          </Form.Item>
          <Form.Item label="审核人" name="reviewerId" rules={[{ required: true, message: "请选择审核人" }]}> 
            <Select options={users.map((item) => ({ label: item.name, value: item.id }))} />
          </Form.Item>
          <Form.Item label="审批说明" name="comment">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
