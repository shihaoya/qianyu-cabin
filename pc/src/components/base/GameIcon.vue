<!--
@doc
name: GameIcon
path: src/components/base/GameIcon.vue
category: base
purpose: 按 type 渲染手绘风图标（内联 SVG，暖色配色）：游戏 climb/fly/slap、留言板 message、用户管理 users、福利 gift，便于扩展
appliesTo: PC
props: type(String, 必填), size(Number=56)
events: 无
example: <GameIcon type="climb" :size="56" />
-->
<script setup>
defineProps({
  type: { type: String, required: true },
  size: { type: Number, default: 56 },
})
</script>

<template>
  <svg
    class="game-icon"
    :style="{ width: size + 'px', height: size + 'px' }"
    viewBox="0 0 200 200"
    fill="none"
    aria-hidden="true"
  >
    <template v-if="type === 'climb'">
      <rect
        x="92"
        y="90"
        width="16"
        height="90"
        rx="4"
        fill="var(--primary)"
      />
      <circle
        cx="100"
        cy="70"
        r="46"
        fill="var(--accent)"
        opacity="0.85"
      />
      <circle
        cx="70"
        cy="86"
        r="30"
        fill="var(--accent)"
        opacity="0.7"
      />
      <circle
        cx="132"
        cy="86"
        r="30"
        fill="var(--accent)"
        opacity="0.7"
      />
      <g transform="translate(118 52)">
        <ellipse
          cx="0"
          cy="0"
          rx="14"
          ry="10"
          fill="var(--primary)"
        />
        <circle
          cx="10"
          cy="-6"
          r="7"
          fill="var(--primary)"
        />
        <path
          d="M17 -6 l8 -2 -6 5Z"
          fill="var(--accent)"
        />
        <circle
          cx="12"
          cy="-7"
          r="1.6"
          fill="#fff"
        />
      </g>
    </template>
    <template v-else-if="type === 'message'">
      <rect
        x="46"
        y="56"
        width="108"
        height="72"
        rx="20"
        fill="var(--accent)"
        opacity="0.85"
      />
      <path
        d="M72 128 l0 22 24 -18Z"
        fill="var(--accent)"
        opacity="0.85"
      />
      <path
        d="M68 88 h64 M68 104 h46"
        stroke="#fff"
        stroke-width="7"
        stroke-linecap="round"
      />
    </template>
    <template v-else-if="type === 'users'">
      <circle
        cx="130"
        cy="80"
        r="20"
        fill="var(--accent)"
        opacity="0.6"
      />
      <path
        d="M106 132 a24 20 0 0 1 48 0Z"
        fill="var(--accent)"
        opacity="0.6"
      />
      <circle
        cx="74"
        cy="90"
        r="24"
        fill="var(--primary)"
      />
      <path
        d="M50 142 a24 24 0 0 1 48 0Z"
        fill="var(--primary)"
      />
    </template>
    <template v-else-if="type === 'gift'">
      <!-- 福利：礼盒 + 丝带，代表可发放的粉丝卡 -->
      <rect
        x="40"
        y="84"
        width="120"
        height="82"
        rx="14"
        fill="var(--primary)"
        opacity="0.92"
      />
      <rect
        x="34"
        y="66"
        width="132"
        height="28"
        rx="12"
        fill="var(--primary)"
      />
      <rect
        x="88"
        y="66"
        width="24"
        height="100"
        fill="var(--primary-soft)"
      />
      <path
        d="M100 66 C84 36 62 42 72 62 C77 72 92 72 100 66Z"
        fill="var(--accent)"
      />
      <path
        d="M100 66 C116 36 138 42 128 62 C123 72 108 72 100 66Z"
        fill="var(--accent)"
      />
      <circle
        cx="100"
        cy="64"
        r="8"
        fill="var(--accent)"
      />
      <rect
        x="60"
        y="106"
        width="30"
        height="8"
        rx="4"
        fill="#fff"
        opacity="0.85"
      />
      <rect
        x="60"
        y="126"
        width="50"
        height="8"
        rx="4"
        fill="#fff"
        opacity="0.6"
      />
    </template>
    <template v-else-if="type === 'fly'">
      <!-- 像素鸟：可爱小鸟 + 绿管道，呼应玩法 -->
      <g opacity="0.92">
        <rect
          x="150"
          y="4"
          width="38"
          height="66"
          rx="6"
          fill="var(--accent)"
        />
        <rect
          x="142"
          y="62"
          width="54"
          height="14"
          rx="4"
          fill="#4a7565"
        />
        <rect
          x="150"
          y="140"
          width="38"
          height="58"
          rx="6"
          fill="var(--accent)"
        />
        <rect
          x="142"
          y="134"
          width="54"
          height="14"
          rx="4"
          fill="#4a7565"
        />
      </g>
      <ellipse
        cx="86"
        cy="104"
        rx="46"
        ry="40"
        fill="var(--primary)"
      />
      <ellipse
        cx="82"
        cy="120"
        rx="33"
        ry="22"
        fill="#f7d9a8"
        opacity="0.92"
      />
      <path
        d="M56 102 q-26 4 -30 28 q22 4 36 -14Z"
        fill="var(--accent)"
        opacity="0.95"
      />
      <circle
        cx="106"
        cy="90"
        r="13"
        fill="#fff"
      />
      <circle
        cx="110"
        cy="91"
        r="6"
        fill="#2b2b2b"
      />
      <path
        d="M124 92 l28 8 -28 12Z"
        fill="#e0a23b"
      />
      <path
        d="M78 64 q4 -16 18 -18"
        stroke="var(--primary)"
        stroke-width="5"
        fill="none"
        stroke-linecap="round"
      />
    </template>
    <template v-else-if="type === 'slap'">
      <!-- 打是亲：挨了一巴掌的小圆脸 + 飞来的手掌 + 星星 -->
      <circle
        cx="76"
        cy="112"
        r="52"
        fill="#f7d9a8"
      />
      <path
        d="M28 100 q6 -46 48 -46 q42 0 48 46 q-10 -18 -48 -18 q-38 0 -48 18Z"
        fill="var(--primary)"
      />
      <path
        d="M76 66 q10 -22 26 -22"
        stroke="var(--primary)"
        stroke-width="7"
        fill="none"
        stroke-linecap="round"
      />
      <g
        stroke="#2b2b2b"
        stroke-width="6"
        fill="none"
        stroke-linecap="round"
      >
        <path d="M52 112 a10 10 0 1 0 12 6" />
        <path d="M100 112 a10 10 0 1 0 12 6" />
      </g>
      <ellipse
        cx="76"
        cy="140"
        rx="12"
        ry="14"
        fill="#b7654a"
      />
      <circle
        cx="42"
        cy="132"
        r="9"
        fill="#e08a6a"
        opacity="0.7"
      />
      <circle
        cx="110"
        cy="132"
        r="9"
        fill="#e08a6a"
        opacity="0.7"
      />
      <g transform="translate(160 96) rotate(14)">
        <rect
          x="10"
          y="-8"
          width="22"
          height="46"
          rx="11"
          fill="#f7d9a8"
          stroke="var(--primary)"
          stroke-width="6"
        />
        <ellipse
          cx="0"
          cy="0"
          rx="20"
          ry="24"
          fill="#f7d9a8"
          stroke="var(--primary)"
          stroke-width="6"
        />
        <g
          fill="#f7d9a8"
          stroke="var(--primary)"
          stroke-width="6"
          stroke-linejoin="round"
        >
          <rect
            x="-20"
            y="-40"
            width="11"
            height="24"
            rx="5.5"
          />
          <rect
            x="-7"
            y="-46"
            width="11"
            height="30"
            rx="5.5"
          />
          <rect
            x="6"
            y="-44"
            width="11"
            height="28"
            rx="5.5"
          />
          <rect
            x="19"
            y="-34"
            width="11"
            height="22"
            rx="5.5"
          />
        </g>
      </g>
      <g fill="#e0a23b">
        <path d="M104 28 l6 13 14 2 -10 10 2 14 -12 -7 -12 7 2 -14 -10 -10 14 -2Z" />
        <path d="M52 40 l4 9 10 1 -7 7 1 10 -8 -5 -8 5 1 -10 -7 -7 10 -1Z" />
      </g>
    </template>
    <!-- 后续新游戏/功能：在此追加 v-else-if="type === 'xxx'" 分支 -->
  </svg>
</template>

<style scoped>
.game-icon {
  display: block;
}
</style>
