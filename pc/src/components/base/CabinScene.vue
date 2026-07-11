<!--
@doc
name: CabinScene
path: src/components/base/CabinScene.vue
category: base
purpose: 小屋场景装饰插画（山丘/木屋/树/太阳），用于首页 Hero 与登录页；纯主题色内联 SVG，宽度由父级控制
appliesTo: PC
props: 无
events: 无
example: <CabinScene />
-->
<script setup></script>

<template>
  <svg
    class="cabin-scene"
    viewBox="0 0 260 200"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="212" cy="46" r="20" fill="#f3c98b" opacity="0.7" />
    <path d="M0 158 Q70 118 140 148 T260 148 V200 H0 Z" fill="#5b8c7b" opacity="0.22" />
    <path d="M0 174 Q90 138 170 166 T260 166 V200 H0 Z" fill="#5b8c7b" opacity="0.34" />
    <rect x="52" y="118" width="9" height="54" rx="3" fill="#a9743b" />
    <circle cx="56" cy="104" r="27" fill="#5b8c7b" opacity="0.85" />
    <circle cx="36" cy="118" r="16" fill="#5b8c7b" opacity="0.7" />
    <circle cx="76" cy="118" r="16" fill="#5b8c7b" opacity="0.7" />
    <rect x="118" y="116" width="96" height="60" rx="4" fill="var(--primary-soft)" />
    <path d="M108 118 L166 80 L224 118 Z" fill="var(--primary)" />
    <rect x="150" y="138" width="24" height="38" rx="2" fill="var(--primary)" />
    <circle cx="167" cy="158" r="2" fill="#fff" />
    <rect x="126" y="128" width="18" height="18" rx="2" fill="#fff" opacity="0.85" />
    <rect x="188" y="128" width="18" height="18" rx="2" fill="#fff" opacity="0.85" />
  </svg>
</template>

<style scoped>
.cabin-scene {
  width: 100%;
  height: auto;
  display: block;
}
</style>
