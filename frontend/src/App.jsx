import { useMemo, useState } from "react";
import {
  ApartmentOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  LogoutOutlined,
  ProjectOutlined,
  TeamOutlined,
  UserOutlined
} from "@ant-design/icons";
import { Button, ConfigProvider, Layout, Menu, Space, Typography } from "antd";
import zhCN from "antd/locale/zh_CN";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import ProjectsPage from "./pages/ProjectsPage";
import DrawingsPage from "./pages/DrawingsPage";
import ComponentsPage from "./pages/ComponentsPage";
import BomsPage from "./pages/BomsPage";
import ReviewsPage from "./pages/ReviewsPage";

const { Header, Sider, Content } = Layout;

const menus = [
  { key: "dashboard", icon: <AppstoreOutlined />, label: "系统看板" },
  { key: "users", icon: <UserOutlined />, label: "用户权限" },
  { key: "projects", icon: <ProjectOutlined />, label: "项目管理" },
  { key: "drawings", icon: <FileTextOutlined />, label: "图纸文档" },
  { key: "components", icon: <DatabaseOutlined />, label: "元器件库" },
  { key: "boms", icon: <ApartmentOutlined />, label: "BOM 管理" },
  { key: "reviews", icon: <TeamOutlined />, label: "审批流程" }
];

function renderPage(key, user) {
  switch (key) {
    case "dashboard":
      return <DashboardPage />;
    case "users":
      return <UsersPage currentUser={user} />;
    case "projects":
      return <ProjectsPage />;
    case "drawings":
      return <DrawingsPage />;
    case "components":
      return <ComponentsPage />;
    case "boms":
      return <BomsPage />;
    case "reviews":
      return <ReviewsPage />;
    default:
      return <DashboardPage />;
  }
}

export default function App() {
  const [selected, setSelected] = useState("dashboard");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  const hasToken = Boolean(localStorage.getItem("token"));
  const isLoggedIn = hasToken && Boolean(user);

  const page = useMemo(() => {
    if (!isLoggedIn) return null;
    return renderPage(selected, user);
  }, [isLoggedIn, selected, user]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setSelected("dashboard");
  };

  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: "#0F766E", borderRadius: 12 } }}>
      {isLoggedIn ? (
        <Layout className="app-layout">
          <Sider width={240} className="app-sider" breakpoint="lg" collapsedWidth={70}>
            <div className="brand">电气研发设计管理系统</div>
            <Menu mode="inline" selectedKeys={[selected]} items={menus} onClick={({ key }) => setSelected(key)} style={{ borderInlineEnd: "none" }} />
          </Sider>
          <Layout>
            <Header className="app-header">
              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  电气研发设计管理平台
                </Typography.Title>
                <Space>
                  <Typography.Text>当前用户：{user?.name}</Typography.Text>
                  <Button icon={<LogoutOutlined />} onClick={logout}>
                    退出登录
                  </Button>
                </Space>
              </Space>
            </Header>
            <Content className="app-content">{page}</Content>
          </Layout>
        </Layout>
      ) : (
        <LoginPage onLogin={setUser} />
      )}
    </ConfigProvider>
  );
}
