# Aula · Sistema de gestión escolar (núcleo)

Monolito modular: **NestJS + Prisma + PostgreSQL** (backend) y **React + Vite** (frontend).
Esta primera entrega incluye solo el núcleo: autenticación, usuarios, roles, permisos, RBAC con Guards y auditoría.

> **Estado de verificación:** el código se escribió y se revisó de forma estática (imports, paquetes declarados,
> sintaxis). **No se ha ejecutado** `npm install`, la compilación ni la app, porque el entorno donde se generó
> no tenía acceso al registro npm. El primer `npm install` + `npm run build` es la verdadera prueba:
> si aparece algún error de tipos, se corrige en minutos.

## Puesta en marcha

```bash
# 1) Base de datos
cd backend && docker compose up -d

# 2) Backend
cp .env.example .env            # cambia JWT_ACCESS_SECRET
npm install
npx prisma migrate dev --name init
npx prisma db seed              # permisos, 6 roles y super admin
npm run start:dev               # API: http://localhost:3000/api/v1  ·  Swagger: /api/docs

# 3) Frontend
cd ../frontend && cp .env.example .env && npm install && npm run dev   # http://localhost:5173
```

Ingreso inicial: `admin@escuela.local` / `Cambiar-Esta-Clave-1` (el sistema obliga a cambiarla en el primer acceso).

## Cómo se protege cada petición

`ThrottlerGuard → JwtAuthGuard → RolesGuard → PermissionsGuard`, todos globales.
Una ruta sin decorador exige sesión; `@Public()` la abre; `@RequirePermissions('user.create')` exige el permiso.
Roles y permisos se leen de la BD en cada request, así que desactivar a alguien o quitar un permiso surte efecto al instante.

## Sesiones

- Access token JWT (15 min) solo en memoria del navegador.
- Refresh token opaco en cookie **HttpOnly**, guardado como hash SHA-256 y **rotado** en cada uso.
  Si se reutiliza uno ya rotado, se revoca toda la familia (posible robo).
- Bloqueo de 15 min tras 5 intentos fallidos; Argon2id para contraseñas; Helmet; rate limit; auditoría.

## Añadir un módulo (p. ej. students)

Backend: carpeta `src/students/` con `controller → service → repository`, importarlo en `AppModule`
y proteger con `@RequirePermissions('student.view')` (los permisos ya existen en el seed).
Frontend: carpeta `src/modules/students/`, un ítem en `app/navigation.js` y una línea en `app/router.jsx`.

## Pendiente a propósito

Tests, envío real de correo (`common/mail`), CSRF extra si el front queda en otro dominio,
y los módulos académicos/administrativos (las tablas ya están reservadas en `schema.prisma`).
