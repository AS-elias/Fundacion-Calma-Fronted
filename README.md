# 🌐 Fundación Calma - Sistema de Gestión Frontend

Sistema web modular para la gestión integral de la Fundación Calma. Diseñado con **Arquitectura Modular Monolítica** escalable a microservicios, siguiendo principios de **Clean Architecture** y preparado para evolucionar a **Micro-Frontends**.

## 🎯 Visión del Proyecto

**Fase Actual (MVP):** Sistema monolítico con 1 módulo (Comercial)  
**Fase Futura:** 9 módulos independientes, escalables a microservicios

### 🏢 Áreas Funcionales (9 Módulos Planificados)

1. ✅ **Comercial** - Clientes, ventas, cotizaciones *(En desarrollo)*
2. 📚 **Académico** - Cursos, estudiantes, programas
3. 💰 **Financiero** - Contabilidad, presupuestos, reportes
4. 👥 **RRHH** - Recursos humanos, nómina, empleados
5. 📦 **Logística** - Inventario, almacén, compras
6. 🎯 **Proyectos** - Gestión de proyectos sociales
7. 🤝 **Beneficiarios** - Registro y seguimiento
8. 📢 **Comunicaciones** - Marketing, campañas
9. ⚙️ **Administración** - Configuración, usuarios, permisos

## 🚀 Tecnologías Principales

* **Framework:** Angular v20+ (Standalone Components, Signals)
* **Estilos:** SCSS (Sass) - Encapsulado por componente
* **Gestor de Paquetes:** npm
* **Entorno de Ejecución:** Node.js v20+
* **Arquitectura:** Modular Monolith + Hexagonal (por módulo)

## 🛠️ Configuración del Entorno (Para nuevos devs)

Si acabas de clonar el repositorio, sigue estos pasos en estricto orden:

1.  **Instalar dependencias:**
    ```bash
    npm install
    ```

2.  **Configurar variables de entorno:**
    * Angular maneja las variables en la carpeta `src/environments/`.
    * Asegúrate de que el archivo `environment.development.ts` apunte a la API local de NestJS (usualmente `http://localhost:3000`).

3.  **Levantar el servidor de desarrollo:**
    ```bash
    ng serve -o
    ```
    *(El flag `-o` abrirá automáticamente la aplicación en tu navegador).*

## ⚡ Comandos de Uso Diario

💻 **Angular CLI (Desarrollo)**

* `ng serve` -> Arranca el servidor local con recarga automática.
* `ng build` -> Compila el proyecto para producción (crea la carpeta `dist/`).
* `ng generate component nombre-componente` -> Crea un nuevo componente rápidamente (o `ng g c nombre-componente`).
* `ng generate service nombre-servicio` -> Crea un nuevo servicio (o `ng g s nombre-servicio`).

## 📂 Arquitectura del Proyecto (Hexagonal / Feature-Sliced)

Para mantener el orden a medida que el proyecto crece, el código dentro de `src/app/` se divide estrictamente en 3 grandes bloques:

```text
src/app/
├── core/                 # ⚙️ Núcleo: Interceptores, Guards, Servicios globales (Auth genérico).
├── shared/               # 🧩 Reutilizables: Botones, Modales, Tarjetas, Pipes genéricos.
└── features/             # 🏢 Módulos de Negocio (Ej: Autenticación, Ventas, Usuarios)
    └── [nombre-feature]/ # Cada módulo aplica Arquitectura Hexagonal internamente:
        ├── domain/       # 🧠 Modelos (Interfaces TypeScript) y Puertos (Interfaces de Repositorios). Nada de Angular aquí.
        ├── infra/        # 🔌 Adaptadores: Servicios HTTP que conectan con NestJS. Implementan los Puertos del domain.
        └── presentation/ # 🎨 Vistas y Componentes: Pages completas y componentes visuales específicos de este módulo.

---
*Nota: Configuración de despliegue dual (Render + GitHub) habilitada correctamente.*