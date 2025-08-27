#!/usr/bin/env python3
import boto3
import json

def create_cloudfront_distribution(domain: str, origin: str) -> str:
    """Creates a CloudFront distribution for a Railway app."""
    cloudfront = boto3.client('cloudfront')
    
    # Create the distribution
    response = cloudfront.create_distribution(
        DistributionConfig={
            'CallerReference': f'migration-{domain}',
            'Origins': {
                'Quantity': 1,
                'Items': [
                    {
                        'Id': 'RailwayOrigin',
                        'DomainName': origin,
                        'CustomOriginConfig': {
                            'HTTPPort': 80,
                            'HTTPSPort': 443,
                            'OriginProtocolPolicy': 'https-only',
                            'OriginSslProtocols': {
                                'Quantity': 1,
                                'Items': ['TLSv1.2']
                            }
                        }
                    }
                ]
            },
            'DefaultCacheBehavior': {
                'TargetOriginId': 'RailwayOrigin',
                'ViewerProtocolPolicy': 'redirect-to-https',
                'AllowedMethods': {
                    'Quantity': 7,
                    'Items': ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'OPTIONS', 'DELETE'],
                    'CachedMethods': {
                        'Quantity': 2,
                        'Items': ['GET', 'HEAD']
                    }
                },
                'Compress': True,
                'DefaultTTL': 0,
                'MaxTTL': 31536000,
                'MinTTL': 0,
                'ForwardedValues': {
                    'QueryString': True,
                    'Cookies': {
                        'Forward': 'all'
                    },
                    'Headers': {
                        'Quantity': 1,
                        'Items': ['*']
                    }
                }
            },
            'Comment': f'Distribution for {domain}',
            'Enabled': True,
            'Aliases': {
                'Quantity': 1,
                'Items': [domain]
            },
            'ViewerCertificate': {
                'ACMCertificateArn': 'arn:aws:acm:us-east-1:720237151757:certificate/b6fb0750-a12b-4a4a-b793-bb67f789ca52',
                'SSLSupportMethod': 'sni-only',
                'MinimumProtocolVersion': 'TLSv1.2_2021'
            }
        }
    )
    
    return response['Distribution']['DomainName']

def main():
    # Records that need CloudFront distributions
    proxied_records = [
        {'domain': 'api.rinawarptech.com', 'origin': 'nu0letsy.up.railway.app'},
        {'domain': 'docs.rinawarptech.com', 'origin': '548iv9i4.up.railway.app'},
        {'domain': 'rinawarptech.com', 'origin': '63s6t4pd.up.railway.app'},
        {'domain': 'www.rinawarptech.com', 'origin': 'rgfux2wz.up.railway.app'}
    ]
    
    print("Before creating CloudFront distributions, you need to:")
    print("1. Create an ACM certificate in us-east-1 for *.rinawarptech.com")
    print("2. Update the script with your ACM certificate ARN")
    print("3. Run the script again")
    
    proceed = input("\nHave you completed these steps? (yes/no): ")
    if proceed.lower() != 'yes':
        print("Please complete the prerequisites and run the script again")
        return
    
    print("\nCreating CloudFront distributions...")
    for record in proxied_records:
        try:
            distribution_domain = create_cloudfront_distribution(
                record['domain'],
                record['origin']
            )
            print(f"Created distribution for {record['domain']}: {distribution_domain}")
        except Exception as e:
            print(f"Error creating distribution for {record['domain']}: {e}")

if __name__ == '__main__':
    main()
