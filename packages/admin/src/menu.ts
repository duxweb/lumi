import type { I18nProvider, I18nTranslations, LumiContext } from '@duxweb/lumi/catalog'
import type { AdminManifest, AdminRoute, TextValue } from './config.js'
import { extendI18nProvider, normalizeResource } from '@duxweb/lumi/catalog'

const ABSOLUTE_URL_RE = /^(?:[a-z]+:)?\/\//i
const LEADING_SLASH_RE = /^\//
const TRAILING_SLASH_RE = /\/$/

const enUS = {
  'lumi.admin.title': 'Lumi Admin',
  'lumi.admin.console': 'Console',
  'lumi.admin.dashboard': 'Dashboard',
  'lumi.admin.workspace': 'Workspace',
  'lumi.admin.search': 'Search navigation...',
  'lumi.admin.noSearchResults': 'No matching navigation items',
  'lumi.admin.user': 'User',
  'lumi.admin.logout': 'Logout',
  'lumi.admin.navigation': 'Navigation',
  'lumi.admin.openNavigation': 'Open navigation',
  'lumi.admin.closeNavigation': 'Close navigation',
  'lumi.admin.closeTab': 'Close {label}',
  'lumi.admin.expandSidebar': 'Expand sidebar',
  'lumi.admin.collapseSidebar': 'Collapse sidebar',
  'lumi.admin.toggleTheme': 'Toggle theme',
  'lumi.admin.notFound': 'Page not found',
  'lumi.admin.include.noHost': 'Include needs an Admin to load pages',
  'lumi.admin.include.cycle': 'Include loop: {path}',
  'lumi.admin.include.depth': 'Includes nest deeper than {max}',
  'lumi.login.subtitle': 'Sign in to manage your workspace.',
  'lumi.login.username': 'Username',
  'lumi.login.password': 'Password',
  'lumi.login.submit': 'Sign in',
  'lumi.login.submitting': 'Signing in...',
  'lumi.login.failed': 'Sign-in failed',
  'lumi.login.hero': 'Build and operate schema-driven admin applications.',
  'lumi.admin.account': 'Account',
  'lumi.admin.assistant': 'Assistant',
  'lumi.admin.authError': 'Session unavailable',
  'lumi.admin.checkingAccess': 'Checking page access',
  'lumi.admin.hideAssistant': 'Hide assistant',
  'lumi.admin.language': 'Language',
  'lumi.admin.loadFailed': 'Failed to load Admin',
  'lumi.admin.loading': 'Loading Admin',
  'lumi.admin.modules': 'Modules',
  'lumi.admin.openTabsMenu': 'Open pages menu',
  'lumi.admin.permissionNext': 'Ask an administrator for the required permission or choose another page from navigation.',
  'lumi.admin.permissionReason': 'Your account does not have access to this page.',
  'lumi.admin.permissionRequired': 'Permission required',
  'lumi.admin.showAssistant': 'Show assistant',
  'lumi.admin.tabs': 'Open pages',
  'lumi.admin.theme': 'Theme',
  'lumi.admin.themeLight': 'Light',
  'lumi.admin.themeDark': 'Dark',
  'lumi.admin.themeSystem': 'System',
  'lumi.assistant.close': 'Close assistant',
  'lumi.assistant.conversation': 'Conversation',
  'lumi.assistant.emptyDescription': 'Ask about this page, or start from a suggestion below.',
  'lumi.assistant.emptyTitle': 'How can I help?',
  'lumi.assistant.history': 'Conversation history',
  'lumi.assistant.message': 'Message',
  'lumi.assistant.new': 'New conversation',
  'lumi.assistant.noHistory': 'No earlier conversations.',
  'lumi.assistant.title': 'Assistant',
  'lumi.dashboard.metrics': 'Key metrics',
  'lumi.detail.activity': 'Activity',
  'lumi.detail.items': 'Items',
  'lumi.detail.loadFailed': 'Could not load record',
  'lumi.form.back': 'Back',
  'lumi.form.continue': 'Next',
  'lumi.form.dirty': 'Unsaved',
  'lumi.form.finish': 'Finish',
  'lumi.form.hasErrors': 'Has errors',
  'lumi.form.leaveCancel': 'Keep editing',
  'lumi.form.leaveConfirm': 'Discard and leave',
  'lumi.form.leaveDescription': 'This page has unsaved changes. Leave the page and discard them?',
  'lumi.form.leaveTitle': 'Discard unsaved changes?',
  'lumi.form.metadata': 'Metadata',
  'lumi.form.name': '{title} form',
  'lumi.form.reset': 'Reset',
  'lumi.form.save': 'Save',
  'lumi.form.saveFailed': 'Save failed',
  'lumi.form.saveFailedReason': 'The changes could not be saved.',
  'lumi.form.saved': 'Changes saved',
  'lumi.form.saving': 'Saving…',
  'lumi.form.skip': 'Skip',
  'lumi.form.stepCount': 'Step {current} of {total}',
  'lumi.list.adjustFilters': 'Adjust the filters and try again.',
  'lumi.list.adjustOrCreate': 'Adjust the filters or create a new record.',
  'lumi.list.columns': 'Columns',
  'lumi.list.filters': 'Filters',
  'lumi.list.loadFailed': 'Could not load records',
  'lumi.audit.created': 'created',
  'lumi.audit.updated': 'updated',
  'lumi.audit.deleted': 'deleted',
  'lumi.audit.imported': 'imported',
  'lumi.audit.importCount': '{succeeded} of {total} records',
  'lumi.audit.system': 'System',
  'lumi.audit.empty': 'No changes recorded yet',
  'lumi.audit.loadFailed': 'Could not load the history',
  'lumi.audit.label': 'Change history',
  'lumi.list.noRecords': 'No records match the current view.',
  'lumi.list.noResults': 'No results',
  'lumi.list.nothing': 'Nothing to show.',
  'lumi.list.pagination': 'Results pagination',
  'lumi.list.progressOf': '{name} progress',
  'lumi.list.results': 'Results',
  'lumi.list.count': '{count} records',
  'lumi.admin.switchWorkspace': 'Switch workspace, current: {name}',
  'lumi.list.resultsOf': '{title} results',
  'lumi.list.savedViews': 'Saved views',
  'lumi.list.scrollRegion': 'Scrollable data table',
  'lumi.list.totals': 'Summary totals',
  'lumi.login.brandRegion': 'About {title}',
  'lumi.login.passwordPlaceholder': 'Enter your password',
  'lumi.login.heroTitle': 'Management made simple and efficient.',
  'lumi.login.heroCopy': 'Data, workflows and permissions in one place, so the team’s everyday work stays clear and organised.',
  'lumi.login.feature1Title': 'Everything at a glance',
  'lumi.login.feature1Copy': 'Key figures and to-dos together on one dashboard.',
  'lumi.login.feature2Title': 'Secure access',
  'lumi.login.feature2Copy': 'Roles and permissions decide what each person can see and do.',
  'lumi.login.feature3Title': 'Works your way',
  'lumi.login.feature3Copy': 'Switch language and light or dark mode at any time.',
  'lumi.login.usernamePlaceholder': 'Enter your username',
  'lumi.login.usernameRequired': 'Enter your username.',
  'lumi.login.passwordRequired': 'Enter your password.',
  'lumi.login.invalid': 'Check your username and password and try again.',
  'lumi.login.showPassword': 'Show password',
  'lumi.login.hidePassword': 'Hide password',
  'lumi.login.remember': 'Remember me',
  'lumi.login.forgot': 'Forgot password?',
  'lumi.login.forgotHint': 'Ask your administrator to reset your password.',
  'lumi.login.demo': 'Demo account',
  'lumi.login.fillDemo': 'Fill in',
  'lumi.login.fillDemoLabel': 'Fill in the demo account',
  'lumi.login.preferences': 'Display preferences',
  'lumi.login.links': 'Related links',
  'lumi.login.welcome': 'Welcome back',
  'lumi.login.heroHighlight': 'simple and efficient',
  'lumi.login.features': 'Features',
  'lumi.login.noAccount': 'New here?',
  'lumi.login.createAccount': 'Create an account',
  'lumi.account.email': 'Email',
  'lumi.account.emailPlaceholder': 'you@company.com',
  'lumi.account.emailInvalid': 'Enter a valid email address.',
  'lumi.account.passwordShort': 'Use at least {count} characters.',
  'lumi.account.newPasswordPlaceholder': 'At least {count} characters',
  'lumi.account.backToSignIn': 'Back to sign in',
  'lumi.register.title': 'Create your account',
  'lumi.register.subtitle': 'It takes a minute; you can change the details later.',
  'lumi.register.name': 'Name',
  'lumi.register.namePlaceholder': 'Your full name',
  'lumi.register.nameRequired': 'Enter your name.',
  'lumi.register.failed': 'The account could not be created.',
  'lumi.register.failedTitle': 'Sign-up failed',
  'lumi.register.submit': 'Create account',
  'lumi.register.submitting': 'Creating account...',
  'lumi.register.haveAccount': 'Already have an account?',
  'lumi.register.signIn': 'Sign in',
  'lumi.forgot.title': 'Reset your password',
  'lumi.forgot.subtitle': 'Enter the email of your account and we will send you a link to set a new password.',
  'lumi.forgot.submit': 'Send reset link',
  'lumi.forgot.submitting': 'Sending...',
  'lumi.forgot.failed': 'The reset link could not be sent. Try again in a moment.',
  'lumi.forgot.failedTitle': 'Not sent',
  'lumi.forgot.sentTitle': 'Check your inbox',
  'lumi.forgot.sentCopy': 'If an account uses {email}, a link to set a new password is on its way. It works once.',
  'lumi.forgot.resend': 'Send again',
  'lumi.reset.title': 'Set a new password',
  'lumi.reset.subtitle': 'Choose a password you do not use anywhere else.',
  'lumi.reset.password': 'New password',
  'lumi.reset.confirm': 'Confirm password',
  'lumi.reset.mismatch': 'The two passwords differ.',
  'lumi.reset.failed': 'The password could not be changed.',
  'lumi.reset.failedTitle': 'Not changed',
  'lumi.reset.submit': 'Save password',
  'lumi.reset.submitting': 'Saving...',
  'lumi.reset.doneTitle': 'Password updated',
  'lumi.reset.doneCopy': 'Sign in with your new password.',
  'lumi.reset.missingTitle': 'This link is incomplete',
  'lumi.reset.missingCopy': 'Open the link from the email again, or ask for a new one.',
  'lumi.reset.requestNew': 'Send a new link',
  'lumi.page.loadingContent': 'Loading content',
  'lumi.page.tryRefresh': 'Try refreshing the page.',
  'lumi.example.result': 'Result',
  'lumi.settings.allSaved': 'All changes saved',
  'lumi.settings.discard': 'Discard',
  'lumi.settings.saved': 'Saved',
  'lumi.settings.sections': 'Settings sections',
  'lumi.kanban.board': 'Board',
  'lumi.kanban.add': 'Add card to {column}',
  'lumi.kanban.collapse': 'Collapse {column}',
  'lumi.kanban.expand': 'Expand {column}',
  'lumi.kanban.count': '{count} cards',
  'lumi.kanban.countLimit': '{count} of {limit} cards',
  'lumi.kanban.overLimit': '{count} cards, over the limit of {limit}',
  'lumi.kanban.empty': 'No cards',
  'lumi.kanban.instructions': 'Press Space to pick up a card, arrow keys to move it, then Space to drop or Escape to cancel.',
  'lumi.kanban.picked': 'Picked up {card}.',
  'lumi.kanban.position': '{column}, position {position} of {total}.',
  'lumi.kanban.dropped': 'Moved {card} to {column}, position {position}.',
  'lumi.kanban.cancelled': 'Move cancelled. {card} stays in {column}.',
  'lumi.kanban.cardRole': 'Draggable card',
  'lumi.kanban.moveMenu': 'Move {card}',
  'lumi.kanban.moveUp': 'Move up',
  'lumi.kanban.moveDown': 'Move down',
  'lumi.kanban.moveTo': 'Move to {column}',
  'lumi.kanban.moveToGroup': 'Column',
  'lumi.kanban.overdue': 'Overdue · {date}',
  'lumi.kanban.priority': 'Priority: {priority}',
  'lumi.kanban.priorityLow': 'Low',
  'lumi.kanban.priorityMedium': 'Medium',
  'lumi.kanban.priorityHigh': 'High',
  'lumi.kanban.priorityUrgent': 'Urgent',
  'lumi.schedule.name': 'Schedule',
  'lumi.schedule.today': 'Today',
  'lumi.schedule.previousMonth': 'Previous month',
  'lumi.schedule.nextMonth': 'Next month',
  'lumi.schedule.previousWeek': 'Previous week',
  'lumi.schedule.nextWeek': 'Next week',
  'lumi.schedule.view': 'Calendar view',
  'lumi.schedule.month': 'Month',
  'lumi.schedule.week': 'Week',
  'lumi.schedule.more': '+{count} more',
  'lumi.schedule.allDay': 'All day',
} as const

const zhCN: Record<keyof typeof enUS, string> = {
  'lumi.admin.title': 'Lumi 管理后台',
  'lumi.admin.console': '控制台',
  'lumi.admin.dashboard': '仪表盘',
  'lumi.admin.workspace': '工作台',
  'lumi.admin.search': '搜索导航...',
  'lumi.admin.noSearchResults': '没有匹配的导航项',
  'lumi.admin.user': '用户',
  'lumi.admin.logout': '退出登录',
  'lumi.admin.navigation': '导航',
  'lumi.admin.openNavigation': '打开导航',
  'lumi.admin.closeNavigation': '关闭导航',
  'lumi.admin.closeTab': '关闭{label}',
  'lumi.admin.expandSidebar': '展开侧边栏',
  'lumi.admin.collapseSidebar': '收起侧边栏',
  'lumi.admin.toggleTheme': '切换主题',
  'lumi.admin.notFound': '页面不存在',
  'lumi.admin.include.noHost': 'Include 需要在 Admin 里才能加载页面',
  'lumi.admin.include.cycle': 'Include 循环引用：{path}',
  'lumi.admin.include.depth': 'Include 嵌套超过 {max} 层',
  'lumi.login.subtitle': '登录以管理你的工作空间。',
  'lumi.login.username': '用户名',
  'lumi.login.password': '密码',
  'lumi.login.submit': '登录',
  'lumi.login.submitting': '登录中...',
  'lumi.login.failed': '登录失败',
  'lumi.login.hero': '构建并运行 Schema 驱动的中后台应用。',
  'lumi.admin.account': '账户',
  'lumi.admin.assistant': '助手',
  'lumi.admin.authError': '会话不可用',
  'lumi.admin.checkingAccess': '正在检查页面权限',
  'lumi.admin.hideAssistant': '隐藏助手',
  'lumi.admin.language': '语言',
  'lumi.admin.loadFailed': '管理后台加载失败',
  'lumi.admin.loading': '正在加载管理后台',
  'lumi.admin.modules': '模块',
  'lumi.admin.openTabsMenu': '打开页面菜单',
  'lumi.admin.permissionNext': '请联系管理员开通权限，或从导航选择其他页面。',
  'lumi.admin.permissionReason': '你的账户无权访问此页面。',
  'lumi.admin.permissionRequired': '需要权限',
  'lumi.admin.showAssistant': '显示助手',
  'lumi.admin.tabs': '已打开的页面',
  'lumi.admin.theme': '主题',
  'lumi.admin.themeLight': '浅色',
  'lumi.admin.themeDark': '深色',
  'lumi.admin.themeSystem': '跟随系统',
  'lumi.assistant.close': '关闭助手',
  'lumi.assistant.conversation': '对话',
  'lumi.assistant.emptyDescription': '可以询问当前页面，或从下方建议开始。',
  'lumi.assistant.emptyTitle': '有什么可以帮你？',
  'lumi.assistant.history': '历史对话',
  'lumi.assistant.message': '消息',
  'lumi.assistant.new': '新对话',
  'lumi.assistant.noHistory': '暂无历史对话。',
  'lumi.assistant.title': '助手',
  'lumi.dashboard.metrics': '关键指标',
  'lumi.detail.activity': '动态',
  'lumi.detail.items': '明细',
  'lumi.detail.loadFailed': '记录加载失败',
  'lumi.form.back': '上一步',
  'lumi.form.continue': '下一步',
  'lumi.form.dirty': '未保存',
  'lumi.form.finish': '完成',
  'lumi.form.hasErrors': '存在错误',
  'lumi.form.leaveCancel': '继续编辑',
  'lumi.form.leaveConfirm': '放弃并离开',
  'lumi.form.leaveDescription': '此页面有未保存的更改。确定离开并放弃这些更改吗？',
  'lumi.form.leaveTitle': '放弃未保存的更改？',
  'lumi.form.metadata': '元信息',
  'lumi.form.name': '{title}表单',
  'lumi.form.reset': '重置',
  'lumi.form.save': '保存',
  'lumi.form.saveFailed': '保存失败',
  'lumi.form.saveFailedReason': '更改未能保存。',
  'lumi.form.saved': '更改已保存',
  'lumi.form.saving': '保存中…',
  'lumi.form.skip': '跳过',
  'lumi.form.stepCount': '第 {current} 步，共 {total} 步',
  'lumi.list.adjustFilters': '调整筛选条件后重试。',
  'lumi.list.adjustOrCreate': '调整筛选条件或新建记录。',
  'lumi.list.columns': '列设置',
  'lumi.list.filters': '筛选',
  'lumi.list.loadFailed': '记录加载失败',
  'lumi.audit.created': '创建了',
  'lumi.audit.updated': '修改了',
  'lumi.audit.deleted': '删除了',
  'lumi.audit.imported': '导入了',
  'lumi.audit.importCount': '{total} 条中的 {succeeded} 条',
  'lumi.audit.system': '系统',
  'lumi.audit.empty': '还没有变更记录',
  'lumi.audit.loadFailed': '变更记录加载失败',
  'lumi.audit.label': '变更记录',
  'lumi.list.noRecords': '当前视图没有匹配的记录。',
  'lumi.list.noResults': '没有结果',
  'lumi.list.nothing': '暂无内容。',
  'lumi.list.pagination': '结果分页',
  'lumi.list.progressOf': '{name}进度',
  'lumi.list.results': '结果',
  'lumi.list.count': '共 {count} 条',
  'lumi.admin.switchWorkspace': '切换工作区，当前：{name}',
  'lumi.list.resultsOf': '{title}结果',
  'lumi.list.savedViews': '已保存的视图',
  'lumi.list.scrollRegion': '可滚动的数据表格',
  'lumi.list.totals': '汇总数据',
  'lumi.login.brandRegion': '关于{title}',
  'lumi.login.passwordPlaceholder': '请输入密码',
  'lumi.login.heroTitle': '让管理更简单、更高效',
  'lumi.login.heroCopy': '数据、流程与权限集中在一处，团队的日常工作清晰有序。',
  'lumi.login.feature1Title': '全局一览',
  'lumi.login.feature1Copy': '关键数据与待办事项集中在一个仪表盘。',
  'lumi.login.feature2Title': '安全可控',
  'lumi.login.feature2Copy': '角色与权限决定每个人能看到和操作的内容。',
  'lumi.login.feature3Title': '随心切换',
  'lumi.login.feature3Copy': '随时切换语言与浅色、深色模式。',
  'lumi.login.usernamePlaceholder': '请输入用户名',
  'lumi.login.usernameRequired': '请输入用户名。',
  'lumi.login.passwordRequired': '请输入密码。',
  'lumi.login.invalid': '请检查用户名和密码后重试。',
  'lumi.login.showPassword': '显示密码',
  'lumi.login.hidePassword': '隐藏密码',
  'lumi.login.remember': '记住我',
  'lumi.login.forgot': '忘记密码？',
  'lumi.login.forgotHint': '请联系管理员重置密码。',
  'lumi.login.demo': '演示账号',
  'lumi.login.fillDemo': '填入',
  'lumi.login.fillDemoLabel': '填入演示账号',
  'lumi.login.preferences': '显示偏好',
  'lumi.login.links': '相关链接',
  'lumi.login.welcome': '欢迎回来',
  'lumi.login.heroHighlight': '更简单、更高效',
  'lumi.login.features': '功能',
  'lumi.login.noAccount': '还没有账号？',
  'lumi.login.createAccount': '创建账号',
  'lumi.account.email': '邮箱',
  'lumi.account.emailPlaceholder': 'you@company.com',
  'lumi.account.emailInvalid': '请输入有效的邮箱地址。',
  'lumi.account.passwordShort': '至少需要 {count} 个字符。',
  'lumi.account.newPasswordPlaceholder': '至少 {count} 个字符',
  'lumi.account.backToSignIn': '返回登录',
  'lumi.register.title': '创建账号',
  'lumi.register.subtitle': '只需一分钟，资料之后可以随时修改。',
  'lumi.register.name': '姓名',
  'lumi.register.namePlaceholder': '你的姓名',
  'lumi.register.nameRequired': '请输入姓名。',
  'lumi.register.failed': '账号未能创建。',
  'lumi.register.failedTitle': '注册失败',
  'lumi.register.submit': '创建账号',
  'lumi.register.submitting': '正在创建...',
  'lumi.register.haveAccount': '已有账号？',
  'lumi.register.signIn': '去登录',
  'lumi.forgot.title': '重置密码',
  'lumi.forgot.subtitle': '输入账号绑定的邮箱，我们会发送一个设置新密码的链接。',
  'lumi.forgot.submit': '发送重置链接',
  'lumi.forgot.submitting': '发送中...',
  'lumi.forgot.failed': '重置链接未能发送，请稍后再试。',
  'lumi.forgot.failedTitle': '发送失败',
  'lumi.forgot.sentTitle': '请查收邮件',
  'lumi.forgot.sentCopy': '如果 {email} 对应一个账号，设置新密码的链接已在路上，该链接只能使用一次。',
  'lumi.forgot.resend': '重新发送',
  'lumi.reset.title': '设置新密码',
  'lumi.reset.subtitle': '请使用一个没有在其他地方用过的密码。',
  'lumi.reset.password': '新密码',
  'lumi.reset.confirm': '确认密码',
  'lumi.reset.mismatch': '两次输入的密码不一致。',
  'lumi.reset.failed': '密码未能修改。',
  'lumi.reset.failedTitle': '修改失败',
  'lumi.reset.submit': '保存密码',
  'lumi.reset.submitting': '保存中...',
  'lumi.reset.doneTitle': '密码已更新',
  'lumi.reset.doneCopy': '请使用新密码登录。',
  'lumi.reset.missingTitle': '链接不完整',
  'lumi.reset.missingCopy': '请重新打开邮件中的链接，或申请一个新链接。',
  'lumi.reset.requestNew': '发送新链接',
  'lumi.page.loadingContent': '正在加载内容',
  'lumi.page.tryRefresh': '请尝试刷新页面。',
  'lumi.example.result': '结果',
  'lumi.settings.allSaved': '所有更改已保存',
  'lumi.settings.discard': '放弃',
  'lumi.settings.saved': '已保存',
  'lumi.settings.sections': '设置分区',
  'lumi.kanban.board': '看板',
  'lumi.kanban.add': '在{column}中添加卡片',
  'lumi.kanban.collapse': '收起{column}',
  'lumi.kanban.expand': '展开{column}',
  'lumi.kanban.count': '{count} 张卡片',
  'lumi.kanban.countLimit': '{count} 张卡片，上限 {limit}',
  'lumi.kanban.overLimit': '{count} 张卡片，已超过上限 {limit}',
  'lumi.kanban.empty': '暂无卡片',
  'lumi.kanban.instructions': '按空格键拿起卡片，用方向键移动，再按空格键放下，按 Esc 取消。',
  'lumi.kanban.picked': '已拿起{card}。',
  'lumi.kanban.position': '{column}，第 {position} 位，共 {total} 位。',
  'lumi.kanban.dropped': '已将{card}移到{column}第 {position} 位。',
  'lumi.kanban.cancelled': '已取消移动，{card}仍在{column}。',
  'lumi.kanban.cardRole': '可拖动的卡片',
  'lumi.kanban.moveMenu': '移动{card}',
  'lumi.kanban.moveUp': '上移',
  'lumi.kanban.moveDown': '下移',
  'lumi.kanban.moveTo': '移到{column}',
  'lumi.kanban.moveToGroup': '列',
  'lumi.kanban.overdue': '已逾期 · {date}',
  'lumi.kanban.priority': '优先级：{priority}',
  'lumi.kanban.priorityLow': '低',
  'lumi.kanban.priorityMedium': '中',
  'lumi.kanban.priorityHigh': '高',
  'lumi.kanban.priorityUrgent': '紧急',
  'lumi.schedule.name': '日程',
  'lumi.schedule.today': '今天',
  'lumi.schedule.previousMonth': '上个月',
  'lumi.schedule.nextMonth': '下个月',
  'lumi.schedule.previousWeek': '上一周',
  'lumi.schedule.nextWeek': '下一周',
  'lumi.schedule.view': '日历视图',
  'lumi.schedule.month': '月',
  'lumi.schedule.week': '周',
  'lumi.schedule.more': '还有 {count} 项',
  'lumi.schedule.allDay': '全天',
}

export const adminTranslations: I18nTranslations = { 'en-US': enUS, 'zh-CN': zhCN }

/** The app's i18n provider with the Admin's own texts beneath it. */
export function createAdminI18nProvider(provider?: I18nProvider): I18nProvider {
  return extendI18nProvider(provider, adminTranslations, { fallbackLocale: 'en-US' })
}

export interface ResolvedAdminRoute {
  route: AdminRoute
  path: string
  /** The access that guards it: its own, else the nearest ancestor's. */
  access?: AdminRoute['access']
}

export interface AdminMenuItem {
  name: string
  label: TextValue
  labelKey?: string
  path: string
  icon?: string
  resource?: string
  action?: string
  order?: number
  group?: NonNullable<AdminRoute['menu']>['group']
  module?: NonNullable<AdminRoute['menu']>['module']
}

export interface AssertAdminRoutesOptions {
  packageName: string
  reservedNames?: Iterable<string>
  reservedPaths?: Iterable<string>
  hostRouteNames?: ReadonlySet<string>
  hostRoutePaths?: ReadonlySet<string>
}

/** A child route's full path: its own when rooted, else joined onto the parent's. */
export function joinAdminRoutePath(parent: string, path: string): string {
  if (path.startsWith('/'))
    return path
  const base = parent === '/' ? '' : parent.replace(TRAILING_SLASH_RE, '')
  return `${base}/${path}` || '/'
}

/** Resolves a page, module or logo address against the manifest's URL; rooted paths and full URLs stay as written. */
export function resolveAdminSource(src: string, manifestSource: string | AdminManifest): string {
  if (typeof manifestSource !== 'string' || ABSOLUTE_URL_RE.test(src) || src.startsWith('/'))
    return src
  try {
    return new URL(src, manifestSource).toString()
  }
  catch {
    const base = new URL(manifestSource, 'https://lumi.invalid/')
    const resolved = new URL(src, base)
    const path = `${resolved.pathname}${resolved.search}${resolved.hash}`
    return manifestSource.startsWith('/') ? path : path.replace(LEADING_SLASH_RE, '')
  }
}

/** Every route of a manifest with its full path and the access it inherits from the nearest ancestor. */
export function flattenAdminRoutes(routes: AdminRoute[], parent = '/', inherited?: AdminRoute['access']): ResolvedAdminRoute[] {
  return routes.flatMap((route) => {
    const path = joinAdminRoutePath(parent, route.path)
    const access = route.access ?? inherited
    return [{ route, path, ...(access ? { access } : {}) }, ...flattenAdminRoutes(route.children ?? [], path, access)]
  })
}

/** The menu items of a manifest: its routes with a visible `menu`, by `order` and then by position. */
export function createAdminMenu(manifest: AdminManifest): AdminMenuItem[] {
  return flattenAdminRoutes(manifest.routes)
    .filter(({ route }) => route.menu && route.menu.hidden !== true)
    // A child without its own access is behind its parent's, so its item is
    // filtered by the same check instead of leading to a refused page.
    .map(({ route, path, access }, index) => ({
      item: {
        name: route.name ?? path,
        label: route.menu!.label,
        labelKey: route.menu!.labelKey,
        path,
        icon: route.menu!.icon,
        resource: access?.resource,
        action: access?.action,
        group: route.menu!.group,
        module: route.menu!.module,
        order: route.menu!.order,
      },
      index,
    }))
    .sort((left, right) => (left.item.order ?? 100) - (right.item.order ?? 100) || left.index - right.index)
    .map(({ item }) => item)
}

/** The menu items the access provider allows; all of them without one. */
export async function filterAdminMenuByAccess(
  context: Pick<LumiContext, 'accessProvider'>,
  items: AdminMenuItem[],
): Promise<AdminMenuItem[]> {
  if (!context.accessProvider)
    return items

  const results = await Promise.all(items.map(async (item) => {
    if (!item.resource)
      return item
    const allowed = await context.accessProvider?.can({ resource: normalizeResource(item.resource), action: item.action ?? 'list' })
    return allowed?.can === false ? undefined : item
  }))

  return results.filter((item): item is AdminMenuItem => Boolean(item))
}

/** Throws when a manifest route takes a name or a path the Admin or the host already uses. */
export function assertAdminRoutesAvailable(manifest: AdminManifest, options: AssertAdminRoutesOptions): void {
  const reservedNames = new Set(options.reservedNames)
  const reservedPaths = new Set(options.reservedPaths)
  const hostRouteNames = options.hostRouteNames ?? new Set<string>()
  const hostRoutePaths = options.hostRoutePaths ?? new Set<string>()

  for (const { route, path } of flattenAdminRoutes(manifest.routes)) {
    if (route.name && reservedNames.has(route.name))
      throw new Error(`[${options.packageName}] manifest route name "${route.name}" is reserved by Admin`)
    if (reservedPaths.has(path))
      throw new Error(`[${options.packageName}] manifest route path "${path}" is reserved by Admin`)
    if (route.name && hostRouteNames.has(route.name))
      throw new Error(`[${options.packageName}] manifest route name "${route.name}" conflicts with a host route`)
    if (hostRoutePaths.has(path))
      throw new Error(`[${options.packageName}] manifest route path "${path}" conflicts with a host route`)
  }
}
