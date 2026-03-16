import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag
} from "antd";
import { z } from "zod";
import { http } from "../api/client";
import { validateOrToast } from "../utils/validation";

const createSchema = z.object({
  name: z.string().min(2, "BOM 名称至少 2 位"),
  stage: z.string().min(1, "请输入阶段"),
  version: z.number().int().positive(),
  projectId: z.number({ invalid_type_error: "请选择项目" })
});

const addItemSchema = z.object({
  componentId: z.number({ invalid_type_error: "请选择元器件" }),
  quantity: z.number().int().positive("数量必须大于 0"),
  unitPrice: z.number().optional(),
  supplier: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal(""))
});

export default function BomsPage() {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [boms, setBoms] = useState([]);
  const [projects, setProjects] = useState([]);
  const [components, setComponents] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [current, setCurrent] = useState(null);
  const [form] = Form.useForm();
  const [itemForm] = Form.useForm();
  const [drawingForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [bomRes, projectRes, componentRes, drawingRes] = await Promise.all([
        http.get("/boms"),
        http.get("/projects"),
        http.get("/components"),
        http.get("/drawings")
      ]);
      setBoms(bomRes.data || []);
      setProjects(projectRes.data || []);
      setComponents(componentRes.data || []);
      setDrawings(drawingRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({ version: 1 });
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    const parsed = validateOrToast(createSchema, values);
    if (!parsed) return;

    await http.post("/boms", parsed);
    setOpen(false);
    await load();
  };

  const removeBom = async (id) => {
    await http.delete(`/boms/${id}`);
    await load();
  };

  const openDrawer = (record) => {
    setCurrent(record);
    itemForm.resetFields();
    drawingForm.resetFields();
    setDrawerOpen(true);
  };

  const addItem = async () => {
    const values = await itemForm.validateFields();
    const parsed = validateOrToast(addItemSchema, values);
    if (!parsed) return;

    await http.post(`/boms/${current.id}/items`, parsed);
    itemForm.resetFields();
    await load();
  };

  const removeItem = async (itemId) => {
    await http.delete(`/boms/${current.id}/items/${itemId}`);
    await load();
  };

  const addDrawing = async () => {
    const values = await drawingForm.validateFields();
    await http.post(`/boms/${current.id}/drawings`, values);
    drawingForm.resetFields();
    await load();
  };

  const removeDrawing = async (drawingId) => {
    await http.delete(`/boms/${current.id}/drawings/${drawingId}`);
    await load();
  };

  const resolvedCurrent = current ? boms.find((item) => item.id === current.id) || current : null;

  const columns = [
    { title: "BOM 名称", dataIndex: "name" },
    { title: "所属项目", render: (_, record) => record.project?.name || "-" },
    { title: "阶段", dataIndex: "stage" },
    { title: "版本", dataIndex: "version", render: (value) => `V${value}` },
    { title: "条目数", render: (_, record) => record.items?.length || 0 },
    {
      title: "操作",
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openDrawer(record)}>
            详情
          </Button>
          <Popconfirm
            title="确认删除该 BOM 吗？"
            description="删除后条目和关联图纸会被移除。"
            okText="确认删除"
            cancelText="取消"
            onConfirm={() => removeBom(record.id)}
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
      title="BOM 物料清单管理"
      extra={
        <Button type="primary" onClick={openCreate}>
          新建 BOM
        </Button>
      }
    >
      <Table rowKey="id" loading={loading} columns={columns} dataSource={boms} pagination={{ pageSize: 8 }} />

      <Modal title="新建 BOM" open={open} onCancel={() => setOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item label="BOM 名称" name="name" rules={[{ required: true, message: "请输入 BOM 名称" }]}> 
            <Input />
          </Form.Item>
          <Space style={{ width: "100%" }}>
            <Form.Item label="设计阶段" name="stage" style={{ flex: 1 }} rules={[{ required: true, message: "请输入设计阶段" }]}> 
              <Input placeholder="例如：方案设计" />
            </Form.Item>
            <Form.Item label="版本号" name="version" style={{ flex: 1 }} rules={[{ required: true, message: "请输入版本号" }]}> 
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
          </Space>
          <Form.Item label="所属项目" name="projectId" rules={[{ required: true, message: "请选择项目" }]}> 
            <Select options={projects.map((item) => ({ label: `${item.name}（${item.code}）`, value: item.id }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title={resolvedCurrent ? `BOM 详情：${resolvedCurrent.name}` : "BOM 详情"} open={drawerOpen} onClose={() => setDrawerOpen(false)} width={760}>
        {resolvedCurrent ? (
          <Space direction="vertical" style={{ width: "100%" }} size={20}>
            <Card size="small" title="新增 BOM 条目">
              <Form form={itemForm} layout="vertical">
                <Space style={{ width: "100%" }} align="start">
                  <Form.Item label="元器件" name="componentId" style={{ minWidth: 220 }} rules={[{ required: true, message: "请选择元器件" }]}> 
                    <Select showSearch optionFilterProp="label" options={components.map((item) => ({ label: `${item.name}（${item.partNumber}）`, value: item.id }))} />
                  </Form.Item>
                  <Form.Item label="数量" name="quantity" rules={[{ required: true, message: "请输入数量" }]}> 
                    <InputNumber min={1} />
                  </Form.Item>
                  <Form.Item label="单价" name="unitPrice">
                    <InputNumber min={0} precision={2} />
                  </Form.Item>
                </Space>
                <Space style={{ width: "100%" }}>
                  <Form.Item label="供应商" name="supplier" style={{ flex: 1 }}>
                    <Input />
                  </Form.Item>
                  <Form.Item label="备注" name="notes" style={{ flex: 1 }}>
                    <Input />
                  </Form.Item>
                </Space>
                <Button type="primary" onClick={addItem}>
                  添加条目
                </Button>
              </Form>
            </Card>

            <Card size="small" title="BOM 条目列表">
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={resolvedCurrent.items || []}
                columns={[
                  { title: "元器件", render: (_, record) => record.component?.name || "-" },
                  { title: "型号", render: (_, record) => record.component?.partNumber || "-" },
                  { title: "数量", dataIndex: "quantity" },
                  { title: "单价", dataIndex: "unitPrice", render: (value) => (value ? `¥${value}` : "-") },
                  {
                    title: "操作",
                    render: (_, record) => (
                      <Popconfirm
                        title="确认删除该条目吗？"
                        okText="确认删除"
                        cancelText="取消"
                        onConfirm={() => removeItem(record.id)}
                      >
                        <Button size="small" danger>
                          删除
                        </Button>
                      </Popconfirm>
                    )
                  }
                ]}
              />
            </Card>

            <Card size="small" title="关联图纸">
              <Form form={drawingForm} layout="inline">
                <Form.Item label="图纸" name="drawingId" rules={[{ required: true, message: "请选择图纸" }]}> 
                  <Select style={{ width: 320 }} options={drawings.map((item) => ({ label: `${item.name}（V${item.version}）`, value: item.id }))} />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" onClick={addDrawing}>
                    添加关联
                  </Button>
                </Form.Item>
              </Form>
              <Space wrap style={{ marginTop: 12 }}>
                {(resolvedCurrent.drawings || []).map((item) => (
                  <Popconfirm
                    key={item.drawingId}
                    title="确认移除该图纸关联吗？"
                    okText="确认移除"
                    cancelText="取消"
                    onConfirm={() => removeDrawing(item.drawingId)}
                  >
                    <Tag style={{ cursor: "pointer" }}>{item.drawing?.name}</Tag>
                  </Popconfirm>
                ))}
              </Space>
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </Card>
  );
}
