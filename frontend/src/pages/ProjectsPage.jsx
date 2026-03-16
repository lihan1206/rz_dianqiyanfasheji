import { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag
} from "antd";
import { z } from "zod";
import { http } from "../api/client";
import { projectStatusLabelMap, projectStatusOptions, roleLabelMap } from "../utils/labels";
import { validateOrToast } from "../utils/validation";

const schema = z.object({
  name: z.string().min(2, "项目名称至少 2 位"),
  code: z.string().min(2, "项目编号至少 2 位"),
  description: z.string().optional().or(z.literal("")),
  status: z.string().min(1, "请选择项目状态"),
  managerId: z.number({ invalid_type_error: "请选择负责人" }),
  dateRange: z.array(z.any()).length(2).optional()
});

export default function ProjectsPage() {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const [memberProject, setMemberProject] = useState(null);
  const [form] = Form.useForm();
  const [memberForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [projectRes, userRes] = await Promise.all([http.get("/projects"), http.get("/users")]);
      setProjects(projectRes.data || []);
      setUsers(userRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setCurrent(null);
    form.resetFields();
    form.setFieldsValue({ status: "PLANNING" });
    setOpen(true);
  };

  const openEdit = (record) => {
    setCurrent(record);
    form.setFieldsValue({
      name: record.name,
      code: record.code,
      description: record.description,
      status: record.status,
      managerId: record.managerId,
      dateRange:
        record.startDate && record.endDate ? [dayjs(record.startDate), dayjs(record.endDate)] : undefined
    });
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    const parsed = validateOrToast(schema, values);
    if (!parsed) return;

    const payload = {
      name: parsed.name,
      code: parsed.code,
      description: parsed.description,
      status: parsed.status,
      managerId: parsed.managerId,
      startDate: parsed.dateRange?.[0] ? dayjs(parsed.dateRange[0]).toISOString() : "",
      endDate: parsed.dateRange?.[1] ? dayjs(parsed.dateRange[1]).toISOString() : ""
    };

    if (current) {
      await http.patch(`/projects/${current.id}`, payload);
    } else {
      await http.post("/projects", payload);
    }

    setOpen(false);
    form.resetFields();
    await load();
  };

  const removeProject = async (id) => {
    await http.delete(`/projects/${id}`);
    await load();
  };

  const openAddMember = (record) => {
    setMemberProject(record);
    memberForm.resetFields();
    setMemberOpen(true);
  };

  const submitAddMember = async () => {
    const values = await memberForm.validateFields();
    await http.post(`/projects/${memberProject.id}/members`, values);
    setMemberOpen(false);
    await load();
  };

  const removeMember = async (projectId, userId) => {
    await http.delete(`/projects/${projectId}/members/${userId}`);
    await load();
  };

  const columns = [
    { title: "项目名称", dataIndex: "name" },
    { title: "项目编号", dataIndex: "code" },
    {
      title: "状态",
      dataIndex: "status",
      render: (status) => <Tag color="blue">{projectStatusLabelMap[status] || status}</Tag>
    },
    { title: "负责人", render: (_, record) => record.manager?.name || "-" },
    {
      title: "成员",
      render: (_, record) =>
        record.members?.length ? (
          <Space wrap>
            {record.members.map((item) => (
              <Popconfirm
                key={item.user.id}
                title="确认移除该成员吗？"
                okText="确认移除"
                cancelText="取消"
                onConfirm={() => removeMember(record.id, item.user.id)}
              >
                <Tag style={{ cursor: "pointer" }}>
                  {item.user.name}（{roleLabelMap[item.user.role] || item.user.role}）
                </Tag>
              </Popconfirm>
            ))}
          </Space>
        ) : (
          "暂无"
        )
    },
    {
      title: "操作",
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button size="small" onClick={() => openAddMember(record)}>
            添加成员
          </Button>
          <Popconfirm
            title="确认删除该项目吗？"
            description="删除后项目相关图纸、BOM、审批记录也会一并删除。"
            okText="确认删除"
            cancelText="取消"
            onConfirm={() => removeProject(record.id)}
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
      title="项目管理"
      extra={
        <Button type="primary" onClick={openCreate}>
          新建项目
        </Button>
      }
    >
      <Table rowKey="id" loading={loading} columns={columns} dataSource={projects} pagination={{ pageSize: 6 }} />

      <Modal title={current ? "编辑项目" : "新建项目"} open={open} onCancel={() => setOpen(false)} onOk={submit} okText="保存" cancelText="取消" width={640}>
        <Form form={form} layout="vertical">
          <Space style={{ width: "100%" }}>
            <Form.Item label="项目名称" name="name" style={{ flex: 1 }} rules={[{ required: true, message: "请输入项目名称" }]}>
              <Input />
            </Form.Item>
            <Form.Item label="项目编号" name="code" style={{ flex: 1 }} rules={[{ required: true, message: "请输入项目编号" }]}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item label="项目描述" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Space style={{ width: "100%" }}>
            <Form.Item label="项目状态" name="status" style={{ flex: 1 }} rules={[{ required: true, message: "请选择项目状态" }]}>
              <Select options={projectStatusOptions} />
            </Form.Item>
            <Form.Item label="项目负责人" name="managerId" style={{ flex: 1 }} rules={[{ required: true, message: "请选择负责人" }]}>
              <Select options={users.map((user) => ({ label: `${user.name}（${roleLabelMap[user.role] || user.role}）`, value: user.id }))} />
            </Form.Item>
          </Space>
          <Form.Item label="项目周期" name="dateRange">
            <DatePicker.RangePicker style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`为项目「${memberProject?.name || ""}」添加成员`} open={memberOpen} onCancel={() => setMemberOpen(false)} onOk={submitAddMember} okText="添加" cancelText="取消">
        <Form form={memberForm} layout="vertical">
          <Form.Item label="选择成员" name="userId" rules={[{ required: true, message: "请选择成员" }]}> 
            <Select options={users.map((user) => ({ label: `${user.name}（${roleLabelMap[user.role] || user.role}）`, value: user.id }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
