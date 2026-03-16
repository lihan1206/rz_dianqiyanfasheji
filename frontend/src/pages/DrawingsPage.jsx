import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Upload
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { z } from "zod";
import { http } from "../api/client";
import { validateOrToast } from "../utils/validation";

const createSchema = z.object({
  name: z.string().min(2, "图纸名称至少 2 位"),
  projectId: z.number({ invalid_type_error: "请选择项目" }),
  tags: z.string().optional().or(z.literal(""))
});

const updateSchema = z.object({
  name: z.string().min(2, "图纸名称至少 2 位").optional(),
  tags: z.string().optional(),
  version: z.number().int().positive().optional()
});

export default function DrawingsPage() {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [drawings, setDrawings] = useState([]);
  const [projects, setProjects] = useState([]);
  const [fileList, setFileList] = useState([]);
  const [current, setCurrent] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const fileHost = useMemo(() => {
    return import.meta.env.VITE_FILE_BASE_URL || "";
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [drawingRes, projectRes] = await Promise.all([http.get("/drawings"), http.get("/projects")]);
      setDrawings(drawingRes.data || []);
      setProjects(projectRes.data || []);
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

    if (!fileList[0]) {
      Modal.warning({ title: "请先选择图纸文件", okText: "知道了" });
      return;
    }

    const body = new FormData();
    body.append("name", parsed.name);
    body.append("projectId", String(parsed.projectId));
    body.append("tags", parsed.tags || "");
    body.append("file", fileList[0].originFileObj);

    await http.post("/drawings", body, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });

    setOpen(false);
    setFileList([]);
    form.resetFields();
    await load();
  };

  const openEdit = (record) => {
    setCurrent(record);
    editForm.setFieldsValue({
      name: record.name,
      tags: record.tags,
      version: record.version
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    const values = await editForm.validateFields();
    const parsed = validateOrToast(updateSchema, values);
    if (!parsed) return;

    await http.patch(`/drawings/${current.id}`, parsed);
    setEditOpen(false);
    await load();
  };

  const remove = async (id) => {
    await http.delete(`/drawings/${id}`);
    await load();
  };

  const columns = [
    { title: "图纸名称", dataIndex: "name" },
    { title: "文件类型", dataIndex: "fileType" },
    { title: "版本", dataIndex: "version", render: (value) => `V${value}` },
    { title: "所属项目", render: (_, record) => record.project?.name || "-" },
    { title: "上传人", render: (_, record) => record.uploadedBy?.name || "-" },
    {
      title: "文件",
      render: (_, record) => (
        <a href={`${fileHost}${record.filePath}`} target="_blank" rel="noreferrer">
          在线查看
        </a>
      )
    },
    {
      title: "操作",
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该图纸吗？"
            description="删除后文件将从系统存储中移除。"
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
      title="设计图纸与文档管理"
      extra={
        <Button type="primary" onClick={() => setOpen(true)}>
          上传图纸
        </Button>
      }
    >
      <Table rowKey="id" loading={loading} columns={columns} dataSource={drawings} pagination={{ pageSize: 8 }} />

      <Modal title="上传图纸" open={open} onCancel={() => setOpen(false)} onOk={submit} okText="上传" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item label="图纸名称" name="name" rules={[{ required: true, message: "请输入图纸名称" }]}> 
            <Input />
          </Form.Item>
          <Form.Item label="所属项目" name="projectId" rules={[{ required: true, message: "请选择项目" }]}> 
            <Select options={projects.map((item) => ({ label: `${item.name}（${item.code}）`, value: item.id }))} />
          </Form.Item>
          <Form.Item label="标签" name="tags">
            <Input placeholder="例如：主回路、控制柜" />
          </Form.Item>
          <Form.Item label="图纸文件">
            <Upload
              beforeUpload={() => false}
              fileList={fileList}
              onChange={({ fileList: next }) => setFileList(next.slice(-1))}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="编辑图纸信息" open={editOpen} onCancel={() => setEditOpen(false)} onOk={submitEdit} okText="保存" cancelText="取消">
        <Form form={editForm} layout="vertical">
          <Form.Item label="图纸名称" name="name" rules={[{ required: true, message: "请输入图纸名称" }]}> 
            <Input />
          </Form.Item>
          <Form.Item label="标签" name="tags">
            <Input />
          </Form.Item>
          <Form.Item label="版本号" name="version" rules={[{ required: true, message: "请输入版本号" }]}> 
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
