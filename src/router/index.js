import { createRouter, createWebHistory } from 'vue-router'

import CatalogView from '../views/CatalogView.vue'
import CourseView from '../views/CourseView.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    scrollBehavior(to, from, savedPosition) {
        if (savedPosition) return savedPosition
        return { top: 0 }
    },
    routes: [
        {
            path: '/',
            name: 'catalog',
            component: CatalogView,
        },
        {
            path: '/curso/:slug',
            name: 'course',
            component: CourseView,
            props: true,
        },
        {
            path: '/:pathMatch(.*)*',
            redirect: '/',
        },
    ],
})

export default router
