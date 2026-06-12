# CloudPivot 项目指令

## 项目规范（自动加载）

@AGENTS.md

## 项目记忆：当前上下文（自动加载）

@memory-bank/activeContext.md

## 记忆银行按需读取路由

`memory-bank/` 是项目的持久记忆，除上面自动加载的 `activeContext.md` 外，按以下场景主动读取对应文件：

- **理解业务逻辑、用户流、业务约束** → 读 `memory-bank/productContext.md`
- **写代码前确认架构约定、设计模式、负向约束（❌ 清单）** → 读 `memory-bank/systemPatterns.md`
- **查依赖版本号、构建命令、数据库 Schema、配置事实** → 读 `memory-bank/techContext.md`
- **回溯版本历史、重大架构变更、已解决的阻碍** → 读 `memory-bank/progress.md`
- **向新人介绍项目全貌、确认范围与交付物** → 读 `memory-bank/projectbrief.md`

涉及上述场景时先读对应文件再动手，不要凭猜测回答其中已记录的事实。

## 记忆银行更新约定

- 每次最终回复前，必须检查本轮是否产生代码变更、重要决策、阻塞或下一步计划；如有，先更新 `memory-bank/activeContext.md`（当前状态、活跃文件、已做决策、下一步、阻塞）。
- 有里程碑、架构变更或长期工程约定变化时，同步更新 `memory-bank/progress.md`。
- 项目已配置 Stop hook（`.claude/hooks/memory-bank-reminder.sh`）在记忆银行落后于代码改动时自动拦截提醒；更新完成后，最终回复中简短说明已同步记忆银行。
