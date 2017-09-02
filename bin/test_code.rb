#!/usr/bin/env ruby

puts "testing sring"
puts "initial: " + ENV['DATABASE_URL']
puts "res: " + ENV['DATABASE_URL'].gsub('?', '_development') 
