---
title: 心同奏配队一图流
teamName: "心同奏配队"
date: 2026-11-10
members:
  - name: "心"
    role: "主C"
  - name: "锁瞑"
    role: "副C"
  - name: "守岸人"
    role: "治疗 / 辅助"
buildMembers:
  - slot: "一号位"
    character: "心"
    hp: "28000"
    attack: "2250"
    energyRegen: "125%"
    critRate: "72%"
    critDamage: "272%"
    keyNodes: [2, 3, 6]
    nodeNotes: "2 命：质变，建议抽；3 命：数值提升；6 命：氪金考虑"
    echoSet: "衍梦照世之心"
    echoCosts:
      - { cost: "COST4", main: "暴击 / 爆伤" }
      - { cost: "COST3", main: "导电 / 攻击" }
      - { cost: "COST3", main: "导电加成" }
      - { cost: "COST1", main: "攻击加成" }
      - { cost: "COST1", main: "攻击加成" }
    echoFirst: "天演溯心"
    substatOrder: "双爆 > 攻击% > 共鸣技能 > 其他"
  - slot: "二号位"
    character: "锁瞑"
    substitute: "今汐"
    echoCosts:
      - { cost: "COST4", main: "暴击 / 爆伤" }
      - { cost: "COST3", main: "衍射 / 攻击" }
      - { cost: "COST3", main: "衍射 / 攻击" }
      - { cost: "COST1", main: "攻击加成" }
      - { cost: "COST1", main: "攻击加成" }
    echoFirst: "绝息魄"
    substatOrder: "双爆 > 攻击% > 普攻 > 共鸣效率"
  - slot: "可替换"
    character: "守岸人"
    substitute: "维里奈"
    hp: "40000"
    attack: "无"
    energyRegen: "260"
    critRate: "无"
    critDamage: "无"
    echoSet: "隐世回光"
    echoCosts:
      - { cost: "COST3", main: "共鸣效率" }
      - { cost: "COST4", main: "生命 / 治疗" }
      - { cost: "COST3", main: "共鸣效率" }
      - { cost: "COST1", main: "生命加成" }
      - { cost: "COST1", main: "生命加成" }
    echoFirst: "无归的谬误"
    substatOrder: "共鸣效率 > 生命 > 其他"
    requirement: "共鸣效率需求 250%"
coreCharacter: "心月狐"
element: "导电"
tier: "T0"
scenario: ["常规配队"]
damageTypes: ["共鸣技能"]
tags: ["同奏", "导电"]
summary: "测试用"
author: "站内示例"
syncBody: true
---

## 角色及其武器

- 一号位 心：—
- 二号位 锁瞑：—
- 可替换 守岸人：—

## 声骸选择

- 一号位 心：套装 衍梦照世之心；首位 天演溯心；副词条 双爆 > 攻击% > 共鸣技能 > 其他
- 二号位 锁瞑：首位 绝息魄；副词条 双爆 > 攻击% > 普攻 > 共鸣效率
- 可替换 守岸人：套装 隐世回光；首位 无归的谬误；副词条 共鸣效率 > 生命 > 其他；共鸣效率需求 250%
