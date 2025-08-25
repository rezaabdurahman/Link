# Employee Access Management

## Overview
Employees access infrastructure through cloud provider IAM, NOT through the app user system.

## AWS Implementation (Recommended)
1. All employees use AWS IAM users or AWS SSO
2. Permissions managed through IAM policies
3. Access to resources via AWS Console, CLI, or kubectl with IAM authenticator
4. Audit trail through CloudTrail

## Access Patterns

### Developers
- Read-only access to production logs
- Full access to staging environment
- Cannot modify production without approval

### DevOps Engineers  
- Full access to infrastructure
- Can restart services, view logs, manage databases
- Emergency production access

### Support Team
- Read-only access to user data (through admin panel)
- Cannot access infrastructure
- Cannot modify system configuration

## Implementation Steps
1. Create AWS IAM roles: link-developer, link-devops, link-support
2. Set up AWS SSO with Google Workspace
3. Configure kubectl to use AWS IAM Authenticator
4. Remove any employee access from app user system

## AWS IAM Role Definitions

### Developer Role
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:GetLogEvents",
        "eks:DescribeCluster",
        "eks:ListClusters"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": ["us-west-2", "us-east-1"]
        }
      }
    }
  ]
}
```

### DevOps Role
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "*",
      "Resource": "*"
    }
  ]
}
```

### Support Role
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:GetLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/link/user-support/*"
    }
  ]
}
```

## Kubernetes RBAC Integration

### Service Account for EKS
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: link-employee-access
  namespace: link-services
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT:role/link-employee-access
```

### ClusterRole for Developers
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: developer-role
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list"]
```

### ClusterRole for DevOps
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: devops-role
rules:
- apiGroups: ["*"]
  resources: ["*"]
  verbs: ["*"]
```

## Access Commands

### Setting up kubectl with AWS IAM
```bash
# Install AWS IAM Authenticator
curl -o aws-iam-authenticator https://amazon-eks.s3.us-west-2.amazonaws.com/1.21.2/2021-07-05/bin/linux/amd64/aws-iam-authenticator
chmod +x ./aws-iam-authenticator
mkdir -p $HOME/bin && cp ./aws-iam-authenticator $HOME/bin/aws-iam-authenticator && export PATH=$PATH:$HOME/bin

# Update kubeconfig
aws eks update-kubeconfig --region us-west-2 --name link-cluster

# Test access
kubectl auth can-i get pods --namespace=link-services
```

### Accessing Production Logs
```bash
# View application logs
aws logs describe-log-groups --log-group-name-prefix="/aws/link/"

# Stream specific service logs
aws logs tail /aws/link/api-gateway --follow
```

## Security Guidelines

### Access Control
1. **Principle of Least Privilege**: Grant minimal permissions needed
2. **Just-in-Time Access**: Use AWS SSO with temporary credentials
3. **MFA Required**: All employee access requires multi-factor authentication
4. **Session Limits**: Sessions expire after 8 hours maximum

### Audit Requirements
1. **All Actions Logged**: CloudTrail captures all API calls
2. **Regular Reviews**: Quarterly access reviews for all employees
3. **Anomaly Detection**: CloudWatch alarms for unusual activity
4. **Compliance**: SOC 2 and ISO 27001 requirements

## Emergency Procedures

### Break-Glass Access
For critical production issues:
1. Use emergency AWS role: `link-emergency-access`
2. Document reason in incident ticket
3. Auto-expires after 4 hours
4. Requires manager approval within 24 hours

### Incident Response
```bash
# Emergency cluster access
aws sts assume-role --role-arn arn:aws:iam::ACCOUNT:role/link-emergency-access --role-session-name emergency-$(date +%s)

# Scale down problematic service
kubectl scale deployment problematic-service --replicas=0 -n link-services

# Check system status
kubectl get pods -n link-services
kubectl get events -n link-services --sort-by='.lastTimestamp'
```

## Monitoring Employee Access

### CloudWatch Dashboards
- Employee login patterns
- Resource access frequency
- Failed authentication attempts
- Privilege escalation attempts

### Alerts
- Unusual access patterns
- After-hours access
- Failed authentication attempts > 5
- Root account usage (should never happen)

## Migration from App User System

### Phase 1: Audit Current Access
```bash
# Find employees with admin roles in app database
psql -d link_users -c "
SELECT u.email, r.name as role 
FROM users u 
JOIN user_roles ur ON u.id = ur.user_id 
JOIN roles r ON ur.role_id = r.id 
WHERE r.name IN ('admin', 'moderator');"
```

### Phase 2: Create AWS IAM Roles
```bash
# Create developer role
aws iam create-role --role-name link-developer --assume-role-policy-document file://developer-trust-policy.json
aws iam attach-role-policy --role-name link-developer --policy-arn arn:aws:iam::ACCOUNT:policy/link-developer-policy

# Create devops role
aws iam create-role --role-name link-devops --assume-role-policy-document file://devops-trust-policy.json
aws iam attach-role-policy --role-name link-devops --policy-arn arn:aws:iam::aws:policy/PowerUserAccess
```

### Phase 3: Remove Employee App Accounts
```sql
-- After AWS access is confirmed working
DELETE FROM user_roles WHERE user_id IN (
  SELECT u.id FROM users u 
  WHERE u.email IN ('employee1@company.com', 'employee2@company.com')
);

DELETE FROM users WHERE email IN (
  'employee1@company.com', 'employee2@company.com'
);
```

## Troubleshooting

### Common Issues
1. **kubectl Access Denied**: Check IAM role has EKS permissions
2. **CloudWatch Logs Empty**: Verify log group exists and IAM role has logs:GetLogEvents
3. **SSO Login Failed**: Check SAML configuration in AWS SSO

### Debug Commands
```bash
# Check current AWS identity
aws sts get-caller-identity

# List available roles
aws iam list-roles --query 'Roles[?contains(RoleName, `link`)]'

# Test kubectl permissions
kubectl auth can-i --list --namespace=link-services
```

## Best Practices

1. **Never use app user accounts for infrastructure access**
2. **Rotate AWS access keys every 90 days**
3. **Use temporary credentials whenever possible**
4. **Log all infrastructure changes in tickets**
5. **Review access permissions quarterly**
6. **Use infrastructure as code for access policies**
7. **Monitor for shadow IT and unauthorized access**

## Related Documentation
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [EKS IAM Integration](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)
- [Link Security Policy](../docs/security/security-policy.md)