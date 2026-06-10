# Kindergarten Management System

Daria Zverieva

## Jak uruchomić

### Docker Compose

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
minikube ip
```
