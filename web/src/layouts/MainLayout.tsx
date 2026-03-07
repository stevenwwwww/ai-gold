import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Avatar, Dropdown, type MenuProps } from 'antd'
import {
  DashboardOutlined, FileTextOutlined, SearchOutlined,
  UserOutlined, LogoutOutlined, KeyOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, TeamOutlined, DatabaseOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/store/auth'

const { Header, Sider, Content } = Layout

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAdmin, logout } = useAuthStore()

  const menuItems: MenuProps['items'] = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: '/reports', icon: <FileTextOutlined />, label: '研报管理' },
    { key: '/search', icon: <SearchOutlined />, label: '研报搜索' },
    {
      key: 'knowledge-group', icon: <DatabaseOutlined />, label: '知识库',
      children: [
        { key: '/knowledge', label: '知识库管理' },
        { key: '/knowledge/search', label: '知识库检索' },
      ],
    },
    ...(isAdmin ? [{ key: '/users', icon: <TeamOutlined />, label: '用户管理' }] : []),
  ]

  const userMenu: MenuProps['items'] = [
    { key: 'profile', icon: <UserOutlined />, label: user?.displayName || user?.username },
    { key: 'password', icon: <KeyOutlined />, label: '修改密码' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ]

  const pathname = location.pathname
  const selectedKey = pathname.startsWith('/knowledge/') ? pathname : '/' + pathname.split('/')[1]
  const openKeys = pathname.startsWith('/knowledge') ? ['knowledge-group'] : []

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark"
        style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 10 }}>
        <div style={{
          height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: collapsed ? 16 : 18,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          {collapsed ? 'AI' : 'AI 研报分析'}
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left .2s' }}>
        <Header style={{
          background: '#fff', padding: '0 24px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)', position: 'sticky', top: 0, zIndex: 9,
        }}>
          <div style={{ cursor: 'pointer', fontSize: 18 }}
            onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>
          <Dropdown menu={{
            items: userMenu,
            onClick: ({ key }) => {
              if (key === 'logout') logout()
              else if (key === 'password') navigate('/password')
            },
          }}>
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar style={{ background: '#1677ff' }} icon={<UserOutlined />} />
              <span>{user?.displayName || user?.username}</span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, minHeight: 360 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
