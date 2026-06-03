// @ts-nocheck
<template lang="pug">
NModal(v-model:show="show" preset="card" title="MIT License" style="max-width: 700px")
  pre.license-text {{ licenseText }}
</template>

<script setup lang="ts">
import { NModal } from 'naive-ui'

const show = defineModel<boolean>({ default: false })

const licenseText = `MIT License

Copyright (c) 2026 Jost Muxfeldt

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.`
</script>

<style lang="sass">
.license-text
  font-size: 0.78rem
  line-height: 1.6
  white-space: pre-wrap
  margin: 0
</style>
