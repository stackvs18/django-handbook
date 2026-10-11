export interface MCQ {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  unit: string;
  category: string;
  explanation: string;
}

export const MCQS: MCQ[] = [
  {
    "id": 445,
    "question": "Q445. What is Django's forms module used for?",
    "options": [
      "URL routing",
      "Data validation and form generation",
      "Dynamic HTML generation",
      "Object-Relational Mapping"
    ],
    "correctIndex": 1,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (B) Data validation and form generation"
  },
  {
    "id": 446,
    "question": "Q446. What does CSRF stand for?",
    "options": [
      "Cross-Site Request Fraud",
      "Cross-Site Request Forgery",
      "Cross-Site Request Firewall",
      "Cross-Site Response Forgery"
    ],
    "correctIndex": 1,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (B) Cross-Site Request Forgery"
  },
  {
    "id": 447,
    "question": "Q447. How does Django protect against CSRF (Cross-Site Request Forgery) attacks?",
    "options": [
      "By using a secret key",
      "By using SSL/TLS",
      "By using a unique token for each request",
      "By using a fixed path"
    ],
    "correctIndex": 2,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (C) By using a unique token for each request"
  },
  {
    "id": 448,
    "question": "Q448. How does Django handle user authentication?",
    "options": [
      "Through the use of a custom authentication backend",
      "By providing a built-in authentication system",
      "By relying on an external authentication service",
      "By using the Django ORM"
    ],
    "correctIndex": 1,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (B) By providing a built-in authentication system"
  },
  {
    "id": 449,
    "question": "Q449. How to Ensure that you have installed Django successfully?",
    "options": [
      "python -m django",
      "python -m",
      "python django",
      "python -m Django"
    ],
    "correctIndex": 0,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (A) python -m django"
  },
  {
    "id": 450,
    "question": "Q450. Which function is used to redirect users to a different URL in Django?",
    "options": [
      "send_redirect",
      "redirect",
      "go_to",
      "forward"
    ],
    "correctIndex": 1,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (B) redirect"
  },
  {
    "id": 451,
    "question": "Q451. What is the purpose of the authenticate function in Django?",
    "options": [
      "It creates a new user.",
      "It checks if a user is authenticated.",
      "It logs a user in.",
      "It logs a user out."
    ],
    "correctIndex": 1,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (B) It checks if a user is authenticated."
  },
  {
    "id": 452,
    "question": "Q452. In Django Template Language, how can you check if a user is authenticated?",
    "options": [
      "user_logged_in",
      "is_authenticated",
      "check_authentication",
      "is_logged_in"
    ],
    "correctIndex": 1,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (B) is_authenticated"
  },
  {
    "id": 453,
    "question": "Q453. Which Django form is commonly used for user registration and account creation?",
    "options": [
      "UserForm",
      "RegisterForm",
      "UserCreationForm",
      "SignupForm"
    ],
    "correctIndex": 2,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (C) UserCreationForm"
  },
  {
    "id": 454,
    "question": "Q454. Which Django form is typically used for user login and authentication?",
    "options": [
      "UserLoginForm",
      "AuthenticationForm",
      "UserLoginForm",
      "AuthForm"
    ],
    "correctIndex": 1,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (B) AuthenticationForm"
  },
  {
    "id": 455,
    "question": "Q455. How do you typically check for a unique username during user registration (sign-up) in Django?",
    "options": [
      "Use the is_unique method on the username field",
      "Add a custom validation function to the username field.",
      "Django automatically enforces unique usernames by default.",
      "Use the unique attribute in the form field definition."
    ],
    "correctIndex": 2,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (C) Django automatically enforces unique usernames by default."
  },
  {
    "id": 456,
    "question": "Q456. In Django, which function is responsible for verifying a user's credentials during the login process?",
    "options": [
      "authenticate",
      "create_user",
      "user_login",
      "validate_user"
    ],
    "correctIndex": 0,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (A) authenticate"
  },
  {
    "id": 457,
    "question": "Q457. What does the 'logout' function do in Django's authentication system?",
    "options": [
      "Logs a user in",
      "Checks if a user is authenticated",
      "Prevents Cross-Site Request Forgery (CSRF) attacks",
      "Logs a user out"
    ],
    "correctIndex": 3,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (D) Logs a user out"
  },
  {
    "id": 458,
    "question": "Q458. What is the primary function of the 'login' function in Django's authentication system during the login process?",
    "options": [
      "It generates a new session ID.",
      "It logs the user out.",
      "It logs the user in.",
      "It retrieves the user's profile information."
    ],
    "correctIndex": 2,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (C) It logs the user in."
  },
  {
    "id": 459,
    "question": "Q459. Which HTTP request method is commonly used for submitting form data in Django?",
    "options": [
      "DELETE",
      "POST",
      "PUT",
      "CONNECT"
    ],
    "correctIndex": 1,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (B) POST"
  },
  {
    "id": 460,
    "question": "Q460. What is the primary purpose of Django's ORM (Object-Relational Mapping) in a web application built using the Django framework?",
    "options": [
      "To define and interact with the database schema using Python code",
      "To handle HTTP requests and responses",
      "To handle asynchronous tasks in the background",
      "To manage user authentication and authorization"
    ],
    "correctIndex": 0,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (A) To define and interact with the database schema using Python code"
  },
  {
    "id": 461,
    "question": "Q461. Find the error in the following Django URL pattern configuration: path('about/', views.about_view, name='about-page')",
    "options": [
      "The path('about/', ...) line is missing the leading forward slash",
      "The path('about/', ...) line is duplicated.",
      "The path('search/<str:keyword>/'...) line should use slug",
      "The path('cart/<int:cart_id>/'...) line should use str"
    ],
    "correctIndex": 1,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (B) The path('about/', ...) line is duplicated."
  },
  {
    "id": 462,
    "question": "Q462. By default, which HTTP method is protected by Django's CSRF protection?",
    "options": [
      "PUT",
      "POST",
      "DELETE",
      "GET"
    ],
    "correctIndex": 1,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (B) POST"
  },
  {
    "id": 463,
    "question": "Q463. Which Django template tag is used for including the content of another template within a template file?",
    "options": [
      "{% extend %}",
      "{% include %}",
      "{% block %}",
      "{% including %}"
    ],
    "correctIndex": 1,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (B) {% include %}"
  },
  {
    "id": 464,
    "question": "Q464. How do you run database migrations in Django in a terminal?",
    "options": [
      "python manage.py migrate",
      "python migrate manage.py",
      "django migrate",
      "Django-admin migrate"
    ],
    "correctIndex": 0,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (A) python manage.py migrate"
  },
  {
    "id": 465,
    "question": "Q465. Which file is kind of your project local django-admin for interacting with your project via command line?",
    "options": [
      "manage.py",
      "admin.py",
      "urls.py",
      "models.py"
    ],
    "correctIndex": 0,
    "unit": "Unit 9",
    "category": "Forms, Auth & CSRF",
    "explanation": "Correct Answer: (A) manage.py"
  },
  {
    "id": 476,
    "question": "Q476. What is the main purpose of a serializer in Django REST Framework?",
    "options": [
      "Create database tables",
      "Convert complex data to JSON",
      "Render HTML",
      "Manage URLs"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "Serializers & ViewSets",
    "explanation": "Correct Answer: (B) Convert complex data to JSON"
  },
  {
    "id": 477,
    "question": "Q477. Which class is used to automatically create serializer from model?",
    "options": [
      "forms.ModelForm",
      "serializers.ModelSerializer",
      "models.Serializer",
      "django.Form"
    ],
    "correctIndex": 2,
    "unit": "Unit 10",
    "category": "Serializers & ViewSets",
    "explanation": "Correct Answer: (C) models.Serializer"
  },
  {
    "id": 478,
    "question": "Q478. What does serializer.is_valid() perform?",
    "options": [
      "Saves data",
      "Deletes data",
      "Validates incoming data",
      "Renders template"
    ],
    "correctIndex": 2,
    "unit": "Unit 10",
    "category": "Serializers & ViewSets",
    "explanation": "Correct Answer: (C) Validates incoming data"
  },
  {
    "id": 479,
    "question": "Q479. Which method is used to save validated serializer data?",
    "options": [
      "serializer.commit()",
      "serializer.push()",
      "serializer.save()",
      "serializer.store()"
    ],
    "correctIndex": 2,
    "unit": "Unit 10",
    "category": "Serializers & ViewSets",
    "explanation": "Correct Answer: (C) serializer.save()"
  },
  {
    "id": 480,
    "question": "Q480. Where are model and fields defined in ModelSerializer?",
    "options": [
      "ViewSet",
      "class Meta",
      "Meta class",
      "Router"
    ],
    "correctIndex": 2,
    "unit": "Unit 10",
    "category": "Serializers & ViewSets",
    "explanation": "Correct Answer: (C) Meta class"
  },
  {
    "id": 481,
    "question": "Q481. What is ViewSet in DRF?",
    "options": [
      "HTML renderer",
      "Class handling multiple CRUD operations",
      "Database manager",
      "URL mapper"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "Serializers & ViewSets",
    "explanation": "Correct Answer: (B) Class handling multiple CRUD operations"
  },
  {
    "id": 482,
    "question": "Q482. Which class provides default CRUD operations?",
    "options": [
      "APIView",
      "GenericView",
      "ModelViewSet",
      "SimpleView"
    ],
    "correctIndex": 2,
    "unit": "Unit 10",
    "category": "Serializers & ViewSets",
    "explanation": "Correct Answer: (C) ModelViewSet"
  },
  {
    "id": 483,
    "question": "Q483. What is the purpose of DefaultRouter?",
    "options": [
      "Create models",
      "Automatically generate URL patterns",
      "Validate serializer",
      "Render HTML"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "Serializers & ViewSets",
    "explanation": "Correct Answer: (B) Automatically generate URL patterns"
  },
  {
    "id": 484,
    "question": "Q484. Which method registers ViewSet with router?",
    "options": [
      "router.add()",
      "router.link()",
      "router.register()",
      "router.connect()"
    ],
    "correctIndex": 2,
    "unit": "Unit 10",
    "category": "Serializers & ViewSets",
    "explanation": "Correct Answer: (C) router.register()"
  },
  {
    "id": 485,
    "question": "Q485. APIView is used when:",
    "options": [
      "Auto CRUD required",
      "Custom control over request handling",
      "Only serializer needed",
      "Only router required"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "Serializers & ViewSets",
    "explanation": "Correct Answer: (B) Custom control over request handling"
  },
  {
    "id": 486,
    "question": "Q486. What does JWT stand for?",
    "options": [
      "Java Web Token",
      "JSON Web Token",
      "Joint Web Token",
      "JavaScript Web Token"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "JWT Auth & Permissions",
    "explanation": "Correct Answer: (B) JSON Web Token"
  },
  {
    "id": 487,
    "question": "Q487. JWT consists of how many parts?",
    "options": [
      "2",
      "3",
      "4",
      "5"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "JWT Auth & Permissions",
    "explanation": "Correct Answer: (B) 3"
  },
  {
    "id": 488,
    "question": "Q488. The three parts of JWT are:",
    "options": [
      "Header Body Footer",
      "Header Payload Signature",
      "Token Key Hash",
      "Header Key Signature"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "JWT Auth & Permissions",
    "explanation": "Correct Answer: (B) Header Payload Signature"
  },
  {
    "id": 489,
    "question": "Q489. JWT token is generally sent in which header?",
    "options": [
      "Content-Type",
      "Authorization",
      "Host",
      "Server"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "JWT Auth & Permissions",
    "explanation": "Correct Answer: (B) Authorization"
  },
  {
    "id": 490,
    "question": "Q490. Correct format of JWT in header is:",
    "options": [
      "Token <token>",
      "Bearer <token>",
      "JWT <token>",
      "Auth <token>"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "JWT Auth & Permissions",
    "explanation": "Correct Answer: (B) Bearer <token>"
  },
  {
    "id": 491,
    "question": "Q491. Role-based API restricts access based on:",
    "options": [
      "IP address",
      "User role",
      "Server type",
      "Database"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "JWT Auth & Permissions",
    "explanation": "Correct Answer: (B) User role"
  },
  {
    "id": 492,
    "question": "Q492. Which permission allows only authenticated users?",
    "options": [
      "AllowAny",
      "IsAuthenticated",
      "IsAdminUser",
      "IsOwner"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "JWT Auth & Permissions",
    "explanation": "Correct Answer: (B) IsAuthenticated"
  },
  {
    "id": 493,
    "question": "Q493. Which permission restricts access to admin users?",
    "options": [
      "IsAuthenticated",
      "IsAdminUser",
      "AllowAny",
      "IsStaff"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "JWT Auth & Permissions",
    "explanation": "Correct Answer: (B) IsAdminUser"
  },
  {
    "id": 494,
    "question": "Q494. Postman is used for:",
    "options": [
      "Database design",
      "API testing",
      "Model training",
      "Template rendering"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "Postman & API Design",
    "explanation": "Correct Answer: (B) API testing"
  },
  {
    "id": 495,
    "question": "Q495. Which HTTP method is used to update resource in Postman?",
    "options": [
      "GET",
      "POST",
      "PUT",
      "HEAD"
    ],
    "correctIndex": 2,
    "unit": "Unit 10",
    "category": "Postman & API Design",
    "explanation": "Correct Answer: (C) PUT"
  },
  {
    "id": 496,
    "question": "Q496. Which status code indicates successful creation?",
    "options": [
      "200",
      "201",
      "400",
      "404"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "Postman & API Design",
    "explanation": "Correct Answer: (B) 201"
  },
  {
    "id": 497,
    "question": "Q497. Which status code indicates unauthorized access?",
    "options": [
      "200",
      "403",
      "401",
      "500"
    ],
    "correctIndex": 2,
    "unit": "Unit 10",
    "category": "Postman & API Design",
    "explanation": "Correct Answer: (C) 401"
  },
  {
    "id": 498,
    "question": "Q498. API versioning is used to:",
    "options": [
      "Increase speed",
      "Maintain backward compatibility",
      "Delete APIs",
      "Secure APIs"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "Postman & API Design",
    "explanation": "Correct Answer: (B) Maintain backward compatibility"
  },
  {
    "id": 499,
    "question": "Q499. Which is a best practice in API design?",
    "options": [
      "Use random URLs",
      "Use proper HTTP methods",
      "Avoid status codes",
      "Ignore authentication"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "Postman & API Design",
    "explanation": "Correct Answer: (B) Use proper HTTP methods"
  },
  {
    "id": 500,
    "question": "Q500. Which attribute makes serializer field read-only?",
    "options": [
      "write_only=True",
      "read_only=True",
      "required=False",
      "editable=False"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (B) read_only=True"
  },
  {
    "id": 501,
    "question": "Q501. Which decorator defines custom action in ViewSet?",
    "options": [
      "@api_view",
      "@router",
      "@action",
      "@permission"
    ],
    "correctIndex": 2,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (C) @action"
  },
  {
    "id": 502,
    "question": "Q502. Which method is overridden for custom validation?",
    "options": [
      "check()",
      "validate()",
      "verify()",
      "clean()"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (B) validate()"
  },
  {
    "id": 503,
    "question": "Q503. JWT token usually includes:",
    "options": [
      "Database ID",
      "Expiration time",
      "HTML content",
      "Session ID"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (B) Expiration time"
  },
  {
    "id": 504,
    "question": "Q504. Purpose of refresh token is:",
    "options": [
      "Delete token",
      "Generate new access token",
      "Change password",
      "Create user"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (B) Generate new access token"
  },
  {
    "id": 505,
    "question": "Q505. Permission classes are defined in:",
    "options": [
      "Serializer",
      "ViewSet",
      "Router",
      "Model"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (B) ViewSet"
  },
  {
    "id": 506,
    "question": "Q506. JWT authentication class is added in:",
    "options": [
      "models.py",
      "settings.py",
      "urls.py",
      "forms.py"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (B) settings.py"
  },
  {
    "id": 507,
    "question": "Q507. Which tab in Postman is used to add headers?",
    "options": [
      "Body",
      "Headers",
      "Tests",
      "Params"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (B) Headers"
  },
  {
    "id": 508,
    "question": "Q508. Delete request uses which method?",
    "options": [
      "GET",
      "POST",
      "DELETE",
      "PATCH"
    ],
    "correctIndex": 2,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (C) DELETE"
  },
  {
    "id": 509,
    "question": "Q509. Router automatically generates which routes?",
    "options": [
      "Template routes",
      "CRUD routes",
      "Static routes",
      "Admin routes"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (B) CRUD routes"
  },
  {
    "id": 510,
    "question": "Q510. Which status code indicates bad request?",
    "options": [
      "200",
      "201",
      "400",
      "404"
    ],
    "correctIndex": 2,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (C) 400"
  },
  {
    "id": 511,
    "question": "Q511. Why should APIs use plural nouns?",
    "options": [
      "Random naming",
      "Represent collections",
      "For styling",
      "For database only"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (B) Represent collections"
  },
  {
    "id": 512,
    "question": "Q512. Purpose of JWT signature is:",
    "options": [
      "Store data",
      "Verify integrity",
      "Render HTML",
      "Route URL"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (B) Verify integrity"
  },
  {
    "id": 513,
    "question": "Q513. Which serializer field is used for email validation?",
    "options": [
      "CharField",
      "IntegerField",
      "EmailField",
      "TextField"
    ],
    "correctIndex": 2,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (C) EmailField"
  },
  {
    "id": 514,
    "question": "Q514. Which component enforces role-based access?",
    "options": [
      "Router",
      "Serializer",
      "Permission classes",
      "Template"
    ],
    "correctIndex": 2,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (C) Permission classes"
  },
  {
    "id": 515,
    "question": "Q515. Which class is used to return API response?",
    "options": [
      "HttpResponse",
      "Response",
      "Render",
      "Redirect"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (B) Response"
  },
  {
    "id": 516,
    "question": "Q516. Validated data is accessed using:",
    "options": [
      "serializer.data",
      "serializer.json",
      "serializer.validated_data",
      "serializer.save"
    ],
    "correctIndex": 2,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (C) serializer.validated_data"
  },
  {
    "id": 517,
    "question": "Q517. Why should APIs return proper status codes?",
    "options": [
      "Random output",
      "Clear client communication",
      "Increase database speed",
      "Hide data"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (B) Clear client communication"
  },
  {
    "id": 518,
    "question": "Q518. Which component verifies JWT token?",
    "options": [
      "Serializer",
      "Router",
      "Authentication class",
      "Model"
    ],
    "correctIndex": 2,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (C) Authentication class"
  },
  {
    "id": 519,
    "question": "Q519. DRF mainly works on which architecture?",
    "options": [
      "MVC",
      "MVT",
      "MVP",
      "Layered"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (B) MVT"
  },
  {
    "id": 520,
    "question": "Q520. What will the following serializer do? class UserSerializer(serializers.ModelSerializer): class Meta: model = User fields = '__all__'",
    "options": [
      "Create HTML form",
      "Serialize all fields of User model",
      "Delete user data",
      "Create router"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (B) Serialize all fields of User model"
  },
  {
    "id": 521,
    "question": "Q521. What happens if serializer.is_valid() returns False in the code? serializer = UserSerializer(data=request.data) serializer.is_valid()",
    "options": [
      "Data saved automatically",
      "Server crashes",
      "Validation errors occur",
      "Model deleted"
    ],
    "correctIndex": 2,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (C) Validation errors occur"
  },
  {
    "id": 522,
    "question": "Q522. What does the following class provide? class UserViewSet(viewsets.ModelViewSet): queryset = User.objects.all() serializer_class = UserSerializer",
    "options": [
      "Automatic CRUD APIs",
      "HTML pages only",
      "Only database models",
      "Only authentication"
    ],
    "correctIndex": 0,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (A) Automatic CRUD APIs"
  },
  {
    "id": 523,
    "question": "Q523. What will the following code do? router = DefaultRouter() router.register(r'users', UserViewSet)",
    "options": [
      "Create serializer",
      "Generate API URLs for UserViewSet",
      "Delete routes",
      "Create models"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (B) Generate API URLs for UserViewSet"
  },
  {
    "id": 524,
    "question": "Q524. What is the purpose of this decorator? @api_view(['GET'])",
    "options": [
      "Create router",
      "Serialize data",
      "Create database",
      "Allow GET request for function-based API"
    ],
    "correctIndex": 3,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (D) Allow GET request for function-based API"
  },
  {
    "id": 525,
    "question": "Q525. What will this line return? return Response(serializer.data)",
    "options": [
      "HTML page",
      "Database object",
      "JSON response",
      "URL redirect"
    ],
    "correctIndex": 2,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (C) JSON response"
  },
  {
    "id": 526,
    "question": "Q526. What does this header indicate? Authorization: Bearer eyJhbGciOiJIUzI...",
    "options": [
      "Database token",
      "JWT authentication token",
      "Router key",
      "Serializer key"
    ],
    "correctIndex": 1,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (B) JWT authentication token"
  },
  {
    "id": 527,
    "question": "Q527. What does the following code check? if request.user.is_authenticated:",
    "options": [
      "User authentication status",
      "Database connection",
      "Router configuration",
      "Serializer validation"
    ],
    "correctIndex": 0,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (A) User authentication status"
  },
  {
    "id": 528,
    "question": "Q528. What does this permission class do? permission_classes = [IsAuthenticated]",
    "options": [
      "Allow anyone",
      "Allow only admin",
      "Disable authentication",
      "Allow only logged-in users"
    ],
    "correctIndex": 3,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (D) Allow only logged-in users"
  },
  {
    "id": 529,
    "question": "Q529. What does this return? return Response({'message': 'Success'})",
    "options": [
      "JSON response message",
      "Database record",
      "Router URL",
      "Serializer object"
    ],
    "correctIndex": 0,
    "unit": "Unit 10",
    "category": "DRF Advanced & Code Snippets",
    "explanation": "Correct Answer: (A) JSON response message"
  }
];