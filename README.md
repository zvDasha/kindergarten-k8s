# Kindergarten Management System

Daria Zverieva

# Kindergarten App

**Autor:** Imię Nazwisko

System zarządzania przedszkolem zabezpieczony OAuth 2.0 z Auth0.

---

## Jak uruchomić

### Docker Compose (najprościej)

```bash
cp .env.example .env

docker-compose up --build
```

| Serwis   | Adres                        |
| -------- | ---------------------------- |
| Frontend | http://localhost:8080        |
| Backend  | http://localhost:3000        |
| Health   | http://localhost:3000/health |

### Kubernetes (minikube)

```bash
minikube start
minikube addons enable ingress
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/
minikube ip   # ten adres w przeglądarce
```
