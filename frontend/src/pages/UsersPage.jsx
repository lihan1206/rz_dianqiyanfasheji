import { useEffect, useState } from "react";
import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag } from "antd";
import { z } from "zod";
import { http } from "../api/client";
import { roleLabelMap, roleOptions } from "../utils/labels";
import { validateOrToast } from "../utils/validation";

const schema = z.object({
  username: z.string().min(3, "用户名至少 3 位"),
  password: z.string().min(6, "密码至少 6 位"),
  name: z.string().min(2, "姓名至少 2 位"),
  role: z.string().min(1, "请选择角色"),
  email: z.string().email("邮箱格式不正确").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal(""))
});

export default function UsersPage({ currentUser }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [users, setUsers] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await http.get("/users");
      setUsers(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    const values = await form.validateFields();
    const parsed = validateOrToast(schema, values);
    if (!parsed) return;

    await http.post("/users", parsed);
    setOpen(false);
    form.resetFields();
    await load();
  };

  const columns = [
    { title: "用户名", dataIndex: "username" },
    { title: "姓名", dataIndex: "name" },
    {
      title: "角色",
      dataIndex: "role",
      render: (role) => <Tag color="blue">{roleLabelMap[role] || role}</Tag>
    },
    { title: "邮箱", dataIndex: "email", render: (value) => value || "-" },
    { title: "电话", dataIndex: "phone", render: (value) => value || "-" }
  ];

  return (
    <Card
      bordered={false}
      className="panel-card"
      title="用户与权限管理"
      extra={
        currentUser?.role === "ADMIN" ? (
          <Button type="primary" onClick={() => setOpen(true)}>
            新建用户
          </Button>
        ) : null
      }
    >
      <Table rowKey="id" loading={loading} columns={columns} dataSource={users} pagination={{ pageSize: 8 }} />

      <Modal title="新建用户" open={open} onCancel={() => setOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: "请输入用户名" }]}> 
            <Input />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}> 
            <Input.Password />
          </Form.Item>
          <Form.Item label="姓名" name="name" rules={[{ required: true, message: "请输入姓名" }]}> 
            <Input />
          </Form.Item>
          <Form.Item label="角色" name="role" rules={[{ required: true, message: "请选择角色" }]}> 
            <Select options={roleOptions} />
          </Form.Item>
          <Space style={{ width: "100%" }}>
            <Form.Item label="邮箱" name="email" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item label="电话" name="phone" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Card>
  );
}
