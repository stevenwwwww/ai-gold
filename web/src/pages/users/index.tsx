import { useEffect, useState } from 'react'
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, Popconfirm, message, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getUsers, createUser, updateUser, deleteUser, type UserItem } from '@/api/users'
import { useAuthStore } from '@/store/auth'

export default function UsersPage() {
  const [data, setData] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const currentUserId = useAuthStore((s) => s.user?.id)

  const loadData = () => {
    setLoading(true)
    getUsers()
      .then(setData)
      .catch(() => message.error('加载失败'))
      .finally(() => setLoading(false))
  }
  useEffect(loadData, [])

  const handleCreate = () => {
    setEditingUser(null)
    form.resetFields()
    form.setFieldsValue({ role: 'trader' })
    setModalOpen(true)
  }

  const handleEdit = (user: UserItem) => {
    setEditingUser(user)
    form.setFieldsValue({
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      password: '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editingUser) {
        const updates: Record<string, string> = {}
        if (values.displayName) updates.displayName = values.displayName
        if (values.role) updates.role = values.role
        if (values.password) updates.password = values.password
        await updateUser(editingUser.id, updates)
        message.success('更新成功')
      } else {
        await createUser(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      loadData()
    } catch (e) {
      if (e instanceof Error) message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (user: UserItem) => {
    const newStatus = user.status === 'active' ? 'disabled' : 'active'
    try {
      await updateUser(user.id, { status: newStatus })
      message.success(newStatus === 'active' ? '已启用' : '已禁用')
      loadData()
    } catch {
      message.error('操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id)
      message.success('删除成功')
      setData((prev) => prev.filter((u) => u.id !== id))
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败')
    }
  }

  const columns: ColumnsType<UserItem> = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '显示名', dataIndex: 'displayName', key: 'displayName' },
    {
      title: '角色', dataIndex: 'role', key: 'role', width: 100,
      render: (r: string) => <Tag color={r === 'admin' ? 'red' : 'blue'}>
        {r === 'admin' ? '超管' : '交易员'}
      </Tag>,
    },
    {
      title: '状态', key: 'status', width: 100,
      render: (_: unknown, record: UserItem) => (
        <Switch checked={record.status === 'active'}
          disabled={record.id === currentUserId}
          onChange={() => handleToggleStatus(record)}
          checkedChildren="启用" unCheckedChildren="禁用" />
      ),
    },
    {
      title: '最后登录', dataIndex: 'lastLoginAt', key: 'lastLogin', width: 150,
      render: (t: number | null) => t ? dayjs(t).format('MM-DD HH:mm') : '-',
    },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'created', width: 150,
      render: (t: number) => dayjs(t).format('YYYY-MM-DD'),
    },
    {
      title: '操作', key: 'action', width: 160,
      render: (_: unknown, record: UserItem) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          {record.id !== currentUserId && (
            <Popconfirm title="确认删除此用户？" onConfirm={() => handleDelete(record.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card title="用户管理" extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建用户</Button>
      }>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
          pagination={false} />
      </Card>

      <Modal title={editingUser ? '编辑用户' : '新建用户'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit} confirmLoading={saving}>
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名"
            rules={[{ required: !editingUser, message: '请输入用户名' }]}>
            <Input disabled={!!editingUser} placeholder="英文/数字" />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称">
            <Input placeholder="中文名" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={[
              { label: '超级管理员', value: 'admin' },
              { label: '交易员', value: 'trader' },
            ]} />
          </Form.Item>
          <Form.Item name="password" label={editingUser ? '新密码（留空不修改）' : '密码'}
            rules={editingUser ? [] : [
              { required: true, message: '请输入密码' },
              { min: 6, message: '至少 6 位' },
            ]}>
            <Input.Password placeholder={editingUser ? '留空保持不变' : '至少6位'} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
