# Lumi 非视觉页面能力架构图

Status: confirmed
Last updated: 2026-08-11
Scope: 七项非视觉能力的模块关系与关键一致性时序
Confirmation: 用户于 2026-08-10 授权连续实施并确认表格三层职责
Document language: 中文

## Diagram decision

表格三层依赖、筛选双查询一致性和 routed drawer/dirty guard 时序涉及三个以上边界，图示能避免把 UI、数据与页面职责混在一起。

## 表格三层模块

```mermaid
flowchart TD
  PC[页面容器\n绑定 resource / filters / navigation] --> UT[useTable\n分页/排序/同步门控]
  PC --> LP[LumiListPage / PageTable\n页面编排]
  LP --> DG[LumiDataGrid / DataTable\n受控数据状态与 UI 编排]
  LP --> KPI[KPI 独立请求\n不随筛选]
  LP --> FB[Filters / toolbar / batch actions]
  DG --> TB[Table + Pagination\n纯受控 UI]
  UT -. rows / total / aggregate / handlers .-> DG
  UT --> UL[useList]
  UT --> AG[aggregate query\n随筛选统计]
  UL --> DP[DataProvider]
  AG --> DP
```

Links: ARC-202, NFR-201

## 协议生成链

```mermaid
flowchart LR
  P[props + component + descriptor] --> C[generated TS catalog]
  C --> V[TS document validator]
  P --> R[generated Rust protocol]
  R --> N[native checker]
  R --> W[WASM checker]
  C --> D[docs / llms / gallery]
  C --> RR[React/Vue contract forwarding]
```

Links: ARC-201

## 同筛选快照时序

```mermaid
sequenceDiagram
  participant Page as LumiListPage
  participant Table as useTable
  participant List as useList
  participant Aggregate as aggregate query
  Page->>Table: filter snapshot F2
  par same immutable snapshot
    Table->>List: rows(F2)
    Table->>Aggregate: stats(F2)
  end
  Aggregate-->>Table: stats(F2)
  Note over Table: rows(F2) 未完成，不公开组合 stats
  List-->>Table: rows + total(F2)
  Table-->>Page: synchronized rows/total/stats(F2)
```

Links: ARC-202
Failure/consistency notes: 任一请求失败时不混用旧 snapshot；resource invalidation 同时命中两类 query key。

## Drawer 与 dirty guard 时序

```mermaid
sequenceDiagram
  participant User as 用户
  participant Route as Admin router
  participant Drawer as routed drawer
  participant Overlay as overlay controller
  participant Guard as unsaved guard
  User->>Drawer: open(key)
  Drawer->>Route: push ?drawer=key
  Route-->>Drawer: query active
  Drawer->>Overlay: open controlled entry
  User->>Overlay: dismiss(Esc/遮罩/X)
  Overlay->>Guard: request close
  alt keep editing
    Guard-->>Overlay: false
    Note over Route,Overlay: URL 和 drawer 均保持
  else discard
    Guard-->>Overlay: true
    Overlay->>Route: approved back/remove query
    Route-->>Drawer: query inactive
    Drawer->>Overlay: route-sync close without second guard
  end
```

Links: ARC-204
Failure/consistency notes: direct shared URL 的关闭使用 replace 去掉 query，避免离站；由本页 open 创建的 history entry 使用 back。
