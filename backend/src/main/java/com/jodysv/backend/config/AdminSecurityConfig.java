package com.jodysv.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;

@Configuration
public class AdminSecurityConfig {

    private static final String ADMIN_USERNAME = "jodyvergara";
    private static final String ADMIN_PASSWORD = "ayem1268";

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/api/admin/session").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/images/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/images/**").hasRole("ADMIN")
                        .anyRequest().permitAll())
                .httpBasic(basic -> basic
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .build();
    }

    @Bean
    UserDetailsService adminUserDetailsService(
            PasswordEncoder passwordEncoder) {
        String encodedPassword = passwordEncoder.encode(ADMIN_PASSWORD);

        return username -> {
            if (!ADMIN_USERNAME.equals(username)) {
                throw new UsernameNotFoundException("Admin user was not found.");
            }
            return User.withUsername(ADMIN_USERNAME)
                    .password(encodedPassword)
                    .roles("ADMIN")
                    .build();
        };
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
