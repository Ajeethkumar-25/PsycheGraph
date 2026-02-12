# Deployment Guide for PsycheGraph on AWS EC2 (t3.micro)

This guide details the steps to deploy the PsycheGraph backend on an AWS EC2 t3.micro instance (Ubuntu).

## Prerequisites

-   AWS Account
-   EC2 Instance (t3.micro, Ubuntu 22.04 LTS recommended) launched.
-   SSH Key Pair (.pem file) for access.
-   Security Group (Firewall) rules:
    -   Inbound: SSH (22), HTTP (80), HTTPS (443)
    -   Outbound: All traffic

## 1. Connect to your Instance

Open your terminal and SSH into your EC2 instance:

```bash
ssh -i "path/to/your-key.pem" ubuntu@<your-ec2-public-ip>
```

## 2. System Updates and Dependencies

Update the package list and install necessary system packages:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv git postgresql postgresql-contrib libpq-dev nginx curl
```

## 3. Clone the Repository

Clone your repository (replace with your actual repo URL if different):

```bash
cd ~
git clone -b api https://github.com/Ajeethkumar-25/PsycheGraph.git
cd PsycheGraph/backend
```

*Note: If your repo is private, you might need to set up SSH keys or use a Personal Access Token.*

## 4. Set up Virtual Environment

Create and activate a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
```

Install Python dependencies:

```bash
pip install -r requirements.txt
pip install gunicorn  # Required for production server
```

## 5. Environment Configuration

Create a `.env` file in the `backend` directory:

```bash
nano .env
```

Paste your environment variables. Example:

```env
DATABASE_URL=postgresql://psycheuser:password@localhost/psychedb
SECRET_KEY=your_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
# Add other variables from your local .env
```

Save and exit (`Ctrl+X`, `Y`, `Enter`).

## 6. Database Setup

Switch to the postgres user and set up the database:

```bash
sudo -u postgres psql
```

Inside the PostgreSQL shell:

```sql
CREATE DATABASE psychedb;
CREATE USER psycheuser WITH PASSWORD 'password';
ALTER ROLE psycheuser SET client_encoding TO 'utf8';
ALTER ROLE psycheuser SET default_transaction_isolation TO 'read committed';
ALTER ROLE psycheuser SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE psychedb TO psycheuser;
\q
```

*Make sure these credentials match your `.env` file.*

## 7. Test the Application

Try running the application manually to ensure everything is set up correctly:

```bash
# Ensure you are widely binding to 0.0.0.0 to test from outside if needed, or stick to localhost
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Visit `http://<your-ec2-public-ip>:8000/docs`. If it works, stop the server (`Ctrl+C`).

## 8. Configure Gunicorn and Systemd

Create a systemd service file to keep the app running in the background:

```bash
sudo nano /etc/systemd/system/psychegraph.service
```

Add the following content (adjust paths if necessary):

```ini
[Unit]
Description=Gunicorn instance to serve PsycheGraph
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/home/ubuntu/PsycheGraph/backend
Environment="PATH=/home/ubuntu/PsycheGraph/backend/venv/bin"
ExecStart=/home/ubuntu/PsycheGraph/backend/venv/bin/gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000

[Install]
WantedBy=multi-user.target
```

Start and enable the service:

```bash
sudo systemctl start psychegraph
sudo systemctl enable psychegraph
```

Check status:

```bash
sudo systemctl status psychegraph
```

## 9. Configure Nginx as Reverse Proxy

Create an Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/psychegraph
```

Add the following content:

```nginx
server {
    listen 80;
    server_name <your-ec2-public-ip-or-domain>;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the configuration:

```bash
sudo ln -s /etc/nginx/sites-available/psychegraph /etc/nginx/sites-enabled/
# Remove default site if it exists
sudo rm /etc/nginx/sites-enabled/default
# Test configuration
sudo nginx -t
# Restart Nginx
sudo systemctl restart nginx
```

Now your API should be accessible at `http://<your-ec2-public-ip>/`.

## 10. (Optional) SSL with Certbot

If you have a domain name, secure your API with SSL:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

**Troubleshooting:**
-   Check logs: `journalctl -u psychegraph -f`
-   Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
