# 💰 USD 收益追踪系统

一个用于追踪美元理财收益的 Web 应用程序，支持记录买入信息、计算综合收益、可视化数据趋势。

## 📋 功能特性

### 核心功能

- **📝 购买记录管理**
  - 记录每次美元买入的日期、汇率、数量
  - 自动计算成本（人民币）
  - 支持批量删除操作

- **🧮 智能收益计算**
  - 输入当前持有量和汇率
  - 自动计算：理财收益率、汇率盈亏、总盈亏
  - 实时显示平均成本汇率和累计持仓

- **📊 数据可视化**
  - **核心指标卡片**：当前累计收益、最高/最低总收益率、当前汇率
  - **汇率走势图**：展示历次计算的实时汇率变化
  - **收益趋势图**：理财收益、汇率盈亏、总盈亏的多维度展示
  - **一键刷新**：手动刷新数据，确保与数据库同步

- **💾 数据持久化**
  - MySQL 数据库存储所有数据
  - 自动保存配置（持仓量、汇率）
  - 历史查询记录完整保存

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | HTML5 + CSS3 + JavaScript | 原生开发，无框架依赖 |
| **图表库** | Plotly.js (v2.27.0) | 专业数据可视化 |
| **后端** | Node.js + Express | RESTful API 服务 |
| **数据库** | MySQL | 数据持久化存储 |
| **样式设计** | 日式简约美学 | 米白/炭黑/墨绿配色 |

## 📁 项目结构

```
财务/
├── index.html              # 主页面（4个视图模块）
├── server.js               # Node.js 后端服务器
├── database.js             # MySQL 数据库连接配置
├── package.json            # Node.js 依赖配置
│
├── start.bat               # ⭐ Windows 启动脚本（标准版）
├── 快速启动.bat             # ⭐ Windows 启动脚本（自动打开浏览器）
├── .gitignore              # Git 忽略配置
│
├── css/
│   └── style.css           # 全局样式（日式简约风格）
│
├── js/
│   ├── storage.js          # 数据访问层（API 调用封装）
│   ├── calculator.js       # 收益计算逻辑引擎
│   ├── charts.js           # 图表渲染（Plotly 封装）
│   └── app.js              # 主应用（事件绑定、视图控制）
│
└── README.md               # 项目文档（本文件）
```

## 🗄️ 数据库设计

### 表结构

#### 1️⃣ `buy_records` - 买入记录表

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | INT (PK) | 主键自增 |
| `buy_time` | DATETIME | 买入日期时间 |
| `buy_rate` | DECIMAL(10,4) | 买入时的汇率 |
| `usd_amount` | DECIMAL(12,2) | 买入的美元数量 |
| `cost_cny` | DECIMAL(14,2) | 成本（人民币） |
| `created_at` | TIMESTAMP | 创建时间 |

#### 2️⃣ `history_records` - 历史计算记录表

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | INT (PK) | 主键自增 |
| `query_time` | DATETIME | 计算日期时间 |
| `current_hold_usd` | DECIMAL(12,2) | 当前持有的美元数量 |
| `current_rate` | DECIMAL(10,4) | 计算时的当前汇率 |
| `finance_roi` | DECIMAL(8,4) | 理财收益率（%） |
| `finance_profit_usd` | DECIMAL(12,2) | 理财收益（美元） |
| `rate_profit_cny` | DECIMAL(14,2) | 汇率盈亏（人民币） |
| `total_profit_cny` | DECIMAL(14,2) | 总盈亏（人民币） |
| `total_roi` | DECIMAL(8,4) | 总收益率（%） |
| `created_at` | TIMESTAMP | 创建时间 |

#### 3️⃣ `config` - 系统配置表

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | INT (PK) | 主键 |
| `current_hold_usd` | DECIMAL(12,2) | 上次的持仓数量 |
| `current_rate` | DECIMAL(10,4) | 上次使用的汇率 |
| `updated_at` | TIMESTAMP | 更新时间 |

### 数据关系

```
buy_records ──→ 计算基准数据
    ↓
history_records ← 保存每次计算的结果（包含 current_rate）
    ↓
config ──────→ 存储用户偏好（自动填充用）
```

## 🚀 安装和运行

### 前置要求

- **Node.js** (v16 或更高版本)
- **MySQL** (5.7 或更高版本)
- 现代浏览器（Chrome/Firefox/Edge）

### 步骤 1: 配置数据库连接

编辑 [database.js](database.js) 文件：

```javascript
module.exports = {
    host: '127.0.0.1',      // 数据库地址
    port: 3306,             // 端口
    user: 'root',           // 用户名
    password: '你的密码',     // 密码
    database: 'usd_invest'  // 数据库名称
};
```

### 步骤 2: 创建数据库表

在 MySQL 中执行以下 SQL（如果表不存在）：

```sql
CREATE DATABASE IF NOT EXISTS usd_invest CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE usd_invest;

-- 买入记录表
CREATE TABLE IF NOT EXISTS buy_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    buy_time DATETIME NOT NULL,
    buy_rate DECIMAL(10,4) NOT NULL,
    usd_amount DECIMAL(12,2) NOT NULL,
    cost_cny DECIMAL(14,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 历史计算记录表
CREATE TABLE IF NOT EXISTS history_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    query_time DATETIME NOT NULL,
    current_hold_usd DECIMAL(12,2) NOT NULL,
    current_rate DECIMAL(10,4) NOT NULL,
    finance_roi DECIMAL(8,4) DEFAULT 0,
    finance_profit_usd DECIMAL(12,2) DEFAULT 0,
    rate_profit_cny DECIMAL(14,2) DEFAULT 0,
    total_profit_cny DECIMAL(14,2) DEFAULT 0,
    total_roi DECIMAL(8,4) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 配置表
CREATE TABLE IF NOT EXISTS config (
    id INT PRIMARY KEY DEFAULT 1,
    current_hold_usd DECIMAL(12,2) DEFAULT 0,
    current_rate DECIMAL(10,4) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO config (id) VALUES (1);
```

### 步骤 3: 安装依赖并启动服务

#### 方式 A：使用启动脚本（推荐）⭐

**Windows 用户：双击运行**

- 📄 `start.bat` - 标准启动（显示详细日志）
- 📄 `快速启动.bat` - 一键启动并自动打开浏览器

双击任意一个脚本即可自动：
1. ✅ 检查 Node.js 环境
2. ✅ 自动安装依赖（首次）
3. ✅ 启动服务器
4. ✅ 打开浏览器（仅快速启动.bat）

#### 方式 B：手动命令行启动

```bash
# 进入项目目录
cd 财务

# 安装 Node.js 依赖（首次运行）
npm install

# 启动后端服务器
node server.js
```

启动成功后会看到：

```
✅ 数据库连接成功
🚀 服务器运行在 http://localhost:3000

📡 API 端点:
   📥 GET /api/buy-records      - 获取买入记录
   📤 POST /api/buy-records      - 添加买入记录
   🗑️ DELETE /api/buy-records    - 删除买入记录
   
   📊 GET /api/history-records   - 获取历史记录
   📤 POST /api/history-records   - 保存计算结果
   🗑️ DELETE /api/history-records - 删除历史记录
   
   ⚙️ GET /api/config            - 获取配置
   ✏️ PUT /api/config            - 更新配置
```

### 步骤 4: 访问应用

⚠️ **重要提示：必须通过 HTTP 服务器访问！**

在浏览器地址栏输入：

```
http://localhost:3000
```

❌ **不要直接双击 `index.html` 文件**（会导致数据无法加载）

原因：这是一个前后端分离的应用，需要通过 HTTP 服务器访问 API 接口获取数据。

## 📖 使用指南

### 视图 1: 购买记录

1. 点击 **"添加记录"** 按钮
2. 填写：
   - **买入日期**：购买美元的日期
   - **买入汇率**：当时的汇率（如 7.2000）
   - **买入数量**：购买的美元金额（如 150）
3. 系统自动计算成本 = 汇率 × 数量
4. 支持批量选择删除

### 视图 2: 收益计算

1. **自动填充**：
   - 平均成本汇率：从买入记录计算得出
   - 累计持仓：显示总持有量
   - 当前汇率：优先使用最新历史记录的汇率

2. **填写参数**：
   - **计算日期**：默认今天
   - **持有美元数量**：当前实际持有量
   - **当前汇率**：最新市场汇率

3. **点击"计算收益"** → 显示结果：
   - 💵 原始成本（人民币）
   - 💰 当前价值（人民币）
   - 📈 理财收益（美元/人民币/收益率）
   - 💱 汇率盈亏（人民币/收益率）
   - 📊 总盈亏（人民币/总收益率）

4. **点击"保存结果"** → 存入数据库

### 视图 3: 计算记录

- 显示所有历史计算结果（**最新的在最上面**）
- 支持批量删除
- 删除后自动刷新核心指标

### 视图 4: 数据可视

#### 核心指标卡片

| 指标 | 数据来源 | 说明 |
|------|---------|------|
| 💰 当前累计收益 | history_records[0] | 最新一次的总盈亏 |
| 📈 最高总收益率 | 遍历所有记录 | 历史最高值 |
| 📉 最低总收益率 | 遍历所有记录 | 历史最低值 |
| 💱 当前汇率 | history_records[0] | 最新一次使用的汇率 |

#### 图表列表

| 图表名称 | 数据来源 | X轴 | Y轴 |
|---------|---------|-----|-----|
| 汇率走势 | history_records.current_rate | 时间 | 汇率值 |
| 汇率盈亏趋势 | history_records.rate_profit_cny | 时间 | 盈亏金额 |
| 理财收益趋势 | history_records.finance_profit_usd × rate | 时间 | 收益金额 |
| 收益率趋势 | 三条线对比 | 时间 | 收益率% |
| 总盈亏趋势 | history_records.total_profit_cny | time | 累积盈亏 |

#### 刷新功能

点击右上角 **🔄 刷新** 按钮：
- 强制重新读取数据库
- 更新核心指标和所有图表
- 显示加载状态反馈

## 🔧 API 接口文档

### 买入记录 API

```
GET    /api/buy-records          获取所有买入记录（倒序）
POST   /api/buy-records          新增买入记录
DELETE /api/buy-records          批量删除（body: { ids: [] }）
GET    /api/buy-records/stats    获取统计信息
```

**请求示例（POST）：**

```json
{
    "date": "2026-03-09",
    "rate": 6.9141,
    "amount": 100
}
```

**响应示例：**

```json
{
    "success": true,
    "message": "添加成功",
    "data": {
        "id": 1,
        "date": "2026-03-09",
        "usdAmount": 100,
        "buyRate": 6.9141,
        "costCNY": 691.41
    }
}
```

### 历史记录 API

```
GET    /api/history-records      获取所有历史记录（倒序）
POST   /api/history-records      保存计算结果
DELETE /api/history-records      批量删除（body: { ids: [] }）
```

**请求示例（POST）：**

```json
{
    "queryTime": "2026-03-09 02:58",
    "currentHoldUSD": 946.40,
    "currentRate": 6.9141,
    "financeROI": 0.15,
    "financeProfitUSD": 1.40,
    "rateProfitCNY": -146.73,
    "totalProfitCNY": -137.33,
    "totalROI": -2.24
}
```

### 配置 API

```
GET /api/config   获取当前配置
PUT /api/config   更新配置
```

## 🎨 设计特点

### UI/UX 设计

- **日式简约美学**：干净的界面，柔和的配色
- **响应式布局**：适配桌面、平板、手机
- **智能交互**：
  - 表单验证和错误提示
  - 加载状态和动画效果
  - 键盘快捷键支持

### 配色方案

| 用途 | 颜色 | 色值 |
|------|------|------|
| 主色调（墨绿） | 正数/主按钮 | `#2D5016` |
| 强调色（暗红） | 负数/危险操作 | `#8B3A3A` |
| 背景色 | 页面背景 | `#FAF9F6` |
| 卡片背景 | 内容区域 | `#FFFFFF` |
| 文字颜色 | 主要文字 | `#333333` |

## ⚠️ 注意事项

1. **数据库安全**
   - 生产环境请修改默认密码
   - 建议使用环境变量管理敏感信息
   - 定期备份数据库

2. **性能优化**
   - 大量数据时建议添加分页功能
   - 图表数据超过 100 条可能影响渲染速度

3. **浏览器兼容性**
   - 推荐使用 Chrome/Edge 最新版
   - 需要 ES6+ 支持（async/await）

4. **数据精度**
   - 汇率保留 4 位小数
   - 金额保留 2 位小数
   - 收益率保留 2-4 位小数

## 📝 开发日志

### v1.0.0 (2026-05-12)

- ✅ 初始版本发布
- ✅ 实现完整的 CRUD 功能
- ✅ 集成 MySQL 数据库
- ✅ 添加数据可视化模块（Plotly.js）
- ✅ 核心指标实时展示
- ✅ 手动刷新功能
- ✅ 日式简约 UI 设计

## 📄 许可证

MIT License

## 👨‍💻 作者

USD 收益追踪系统 - 个人理财工具

---

**如有问题或建议，欢迎提出 Issue 或 Pull Request！** 🚀
