<script setup lang="ts">
const modelo = defineModel<string>({ required: true });

const props = defineProps<{
  id: string;
  rotulo: string;
  tipo?: string;
  autocomplete?: string;
  erro?: string | undefined;
}>();

const idErro = `erro-${props.id}`;
</script>

<template>
  <div>
    <label :for="id" class="rotulo">{{ rotulo }}</label>
    <input
      :id="id"
      v-model="modelo"
      :type="tipo ?? 'text'"
      :autocomplete="autocomplete"
      class="campo"
      :aria-invalid="erro !== undefined"
      :aria-describedby="erro !== undefined ? idErro : undefined"
    />
    <p v-if="erro" :id="idErro" class="erro-campo">{{ erro }}</p>
  </div>
</template>
