import { useEffect, useState } from "react";
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Space, Table } from "antd";
import { z } from "zod";
import { http } from "../api/client";
import { validateOrToast } from "../utils/validation";

const schema = z.object({
  name: z.string().min(2, "元器件名称至少 2 位"),
  partNumber: z.string().min(2, "型号至少 2 位"),
  category: z.string().min(1, "请输入分类"),
  specification: z.string().optional().or(z.literal("")),
  packageType: z.string().optional().or(z.literal("")),
  voltageRating: z.number().optional().nullable(),
  powerRating: z.number().optional().nullable(),
  price: z.number().optional().nullable(),
  manufacturer: z.string().optional().or(z.literal("")),
  datasheetUrl: z.string().url("资料链接格式不正确").optional().or(z.literal(""))
});

export default function ComponentsPage() {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [components, setComponents] = useState([]);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await http.get("/components");
      setComponents(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      voltageRating: record.voltageRating ? Number(record.voltageRating) : undefined,
      powerRating: record.powerRating ? Number(record.powerRating) : undefined,
      price: record.price ? Number(record.price) : undefined
    });
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    const parsed = validateOrToast(schema, values);
    if (!parsed) return;

    if (editing) {
      await http.patch(`/components/${editing.id}`, parsed);
    } else {
      await http.post("/components", parsed);
    }

    setOpen(false);
    await load();
  };

  const remove = async (id) => {
    await http.delete(`/components/${id}`);
    await load();
  };

  const columns = [
    { title: "名称", dataIndex: "name" },
    { title: "型号", dataIndex: "partNumber" },
    { title: "分类", dataIndex: "category" },
    { title: "规格", dataIndex: "specification", render: (value) => value || "-" },
    { title: "额定电压", dataIndex: "voltageRating", render: (value) => (value ? `${value}V` : "-") },
    { title: "单价", dataIndex: "price", render: (value) => (value ? `¥${value}` : "-") },
    {
      title: "操作",
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该元器件吗？"
            description="删除后可能影响已有 BOM 条目。"
            okText="确认删除"
            cancelText="取消"
            onConfirm={() => remove(record.id)}
          >
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Card
      bordered={false}
      className="panel-card"
      title="元器件库管理"
      extra={
        <Button type="primary" onClick={openCreate}>
          新建元器件
        </Button>
      }
    >
      <Table rowKey="id" loading={loading} columns={columns} dataSource={components} pagination={{ pageSize: 8 }} />

      <Modal title={editing ? "编辑元器件" : "新建元器件"} open={open} onCancel={() => setOpen(false)} onOk={submit} okText="保存" cancelText="取消" width={680}>
        <Form form={form} layout="vertical">
          <Space style={{ width: "100%" }}>
            <Form.Item label="名称" name="name" style={{ flex: 1 }} rules={[{ required: true, message: "请输入名称" }]}> 
              <Input />
            </Form.Item>
            <Form.Item label="型号" name="partNumber" style={{ flex: 1 }} rules={[{ required: true, message: "请输入型号" }]}> 
              <Input />
            </Form.Item>
          </Space>
          <Space style={{ width: "100%" }}>
            <Form.Item label="分类" name="category" style={{ flex: 1 }} rules={[{ required: true, message: "请输入分类" }]}> 
              <Input />
            </Form.Item>
            <Form.Item label="封装" name="packageType" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item label="规格" name="specification">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space style={{ width: "100%" }}>
            <Form.Item label="额定电压(V)" name="voltageRating" style={{ flex: 1 }}>
              <InputNumber style={{ width: "100%" }} min={0} precision={2} />
            </Form.Item>
            <Form.Item label="额定功率(W)" name="powerRating" style={{ flex: 1 }}>
              <InputNumber style={{ width: "100%" }} min={0} precision={2} />
            </Form.Item>
            <Form.Item label="单价(元)" name="price" style={{ flex: 1 }}>
              <InputNumber style={{ width: "100%" }} min={0} precision={2} />
            </Form.Item>
          </Space>
          <Space style={{ width: "100%" }}>
            <Form.Item label="厂商" name="manufacturer" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item label="资料链接" name="datasheetUrl" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Card>
  );
}
