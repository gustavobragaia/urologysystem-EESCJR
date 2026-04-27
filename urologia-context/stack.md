# Stack e Dependências

## Backend

**Runtime:** Node.js 20 LTS  
**Linguagem:** TypeScript 5.4+

### Dependências de produção
- express ^4.19
- cors ^2.8
- helmet (CSP, X-Frame-Options)
- express-rate-limit ^7.3
- drizzle-orm ^0.30
- postgres (porsager) ^3.4
- zod ^3.23
- @supabase/supabase-js ^2.43
- pdfkit ^0.15
- chartjs-node-canvas (latest)
- chart.js (peer de chartjs-node-canvas)
- swagger-ui-express
- swagger-jsdoc
- dotenv

### Dependências de dev
- typescript ^5.4
- tsx ^4.16 (dev server + mock)
- @types/express
- @types/cors
- @types/pdfkit
- @types/swagger-ui-express
- @types/swagger-jsdoc
- drizzle-kit ^0.20

## Frontend

**Framework:** React 18.3+  
**Build:** Vite 5.3+  
**Linguagem:** TypeScript 5.4+

### Dependências principais
- react ^18.3
- react-dom ^18.3
- react-router-dom ^6.24
- @tanstack/react-query ^5.51
- react-hook-form ^7.52
- @hookform/resolvers ^3
- zod ^3.23
- axios ^1.7
- @supabase/supabase-js ^2.43
- recharts ^2.12
- sonner ^1.5
- date-fns ^3.6
- lucide-react
- tailwindcss ^3.4
- tailwindcss-animate
- clsx
- tailwind-merge

### shadcn/ui components
button, input, label, dialog, alert-dialog, dropdown-menu, select, form, sheet, sonner, badge, card, skeleton, tabs, separator, scroll-area

## Mock
- tsx ^4.16
- typescript ^5.4

## Status de instalação
- [ ] Backend: npm install
- [ ] Frontend: npm install + shadcn init + components
- [ ] Mock: npm install
