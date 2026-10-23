import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';
import './app.css';

// Precaches the app shell and keeps itself updated; data is cached network-first.
registerSW({ immediate: true });

export default mount(App, { target: document.getElementById('app')! });
